import type { SupabaseClient } from '@supabase/supabase-js';
import type { FitnessUserProfile } from './profile';
import {
    generateCardioBlock,
    generateStretchCooldown,
    generateWorkoutPlanFromCatalog,
    type GeneratedWorkoutItem,
    type WorkoutDifficulty,
} from './workoutGenerator';
import {
    addWorkoutPlanItem,
    createWorkoutPlanFromGeneratedPlan,
    getWorkoutPlanWithItems,
    listWorkoutPlansForUser,
    type WorkoutPlanWithItems,
} from './workoutPlans';
import { activateProgramForUser } from './programEngine';
import { getPublishedExercises } from './exercises';

function mapTrainingLevelToDifficulty(level: FitnessUserProfile['training_level']): WorkoutDifficulty {
    if (level === 'advanced') return 'advanced';
    if (level === 'intermediate') return 'intermediate';
    return 'beginner';
}

function pickMusclesFromProfile(profile: FitnessUserProfile): string[] {
    const set = new Set<string>();

    // Baseline: full-body fundamentals.
    ['quads', 'glutes', 'chest', 'upper-back', 'core'].forEach((m) => set.add(m));

    if (profile.goals.includes('strength')) {
        ['hamstrings', 'shoulders'].forEach((m) => set.add(m));
    }
    if (profile.goals.includes('muscle_gain')) {
        ['lats', 'biceps', 'triceps'].forEach((m) => set.add(m));
    }
    if (profile.goals.includes('better_cardio') || profile.goals.includes('muscle_endurance')) {
        ['calves', 'core'].forEach((m) => set.add(m));
    }
    if (profile.goals.includes('fat_loss')) {
        ['quads', 'hamstrings', 'core'].forEach((m) => set.add(m));
    }

    // Fewer weekly days -> prioritize core full-body essentials.
    if (profile.days_per_week <= 2) {
        return ['quads', 'glutes', 'chest', 'upper-back', 'core'];
    }

    return [...set];
}

function pickExerciseCount(profile: FitnessUserProfile): number {
    if (profile.session_duration_minutes <= 35) return 4;
    if (profile.session_duration_minutes <= 50) return 5;
    return 6;
}

function buildPlanName(profile: FitnessUserProfile): string {
    const level = profile.training_level.charAt(0).toUpperCase() + profile.training_level.slice(1);
    return `${level} Personalized Starter Plan`;
}

function buildPlanDescription(profile: FitnessUserProfile): string {
    const goalLabels = profile.goals
        .map((g) =>
            ({
                fat_loss: 'fat loss',
                muscle_gain: 'muscle gain',
                strength: 'strength',
                general_fitness: 'general fitness',
                better_cardio: 'better cardio',
                muscle_endurance: 'muscle endurance',
            }[g])
        )
        .join(', ');
    return `Auto-generated from onboarding profile: ${profile.days_per_week} days/week, ${profile.session_duration_minutes} min/session, goals: ${goalLabels}.`;
}

/**
 * Generates a single tailored starter plan from onboarding profile.
 * Deterministic rules only; no AI.
 */
export async function generatePersonalizedStarterPlanForUser(
    userId: string,
    profile: FitnessUserProfile,
    options?: { aiItems?: Array<{ exercise_slug: string; sets: number; rep_range: string; rest_seconds: number; note?: string | null }> },
    supabase?: SupabaseClient
): Promise<WorkoutPlanWithItems> {
    const existingPlans = await listWorkoutPlansForUser(userId, supabase);
    const existingStarter = existingPlans.find((p) => p.name === buildPlanName(profile));
    if (existingStarter) {
        await activateProgramForUser({
            userId,
            planId: existingStarter.id,
            trainingWeekdays: profile.training_weekdays,
            trainingLevel: profile.training_level,
            supabase,
        });
        // Keep behavior idempotent for repeated CTA clicks.
        return {
            ...existingStarter,
            items: [],
        };
    }

    const difficulty = mapTrainingLevelToDifficulty(profile.training_level);
    const muscleSlugs = pickMusclesFromProfile(profile);
    const count = pickExerciseCount(profile);
    let generatedItems: GeneratedWorkoutItem[] = [];
    const aiItems = options?.aiItems ?? [];
    if (aiItems.length > 0) {
        const exercises = await getPublishedExercises(supabase);
        const bySlug = new Map(exercises.map((ex) => [ex.slug, ex]));
        generatedItems = aiItems
            .map((item): GeneratedWorkoutItem | null => {
                const exercise = bySlug.get(item.exercise_slug);
                if (!exercise) return null;
                const row: GeneratedWorkoutItem = {
                    exercise,
                    sets: Math.min(6, Math.max(2, item.sets)),
                    repRange: item.rep_range,
                    restSeconds: Math.min(180, Math.max(30, item.rest_seconds)),
                };
                if (item.note != null && item.note !== '') {
                    row.note = item.note;
                }
                return row;
            })
            .filter((item): item is GeneratedWorkoutItem => item !== null);
    }
    if (generatedItems.length === 0) {
        generatedItems = await generateWorkoutPlanFromCatalog(
            {
                muscleSlugs,
                difficulty,
                count,
                publishedOnly: true,
            },
            supabase,
            difficulty,
            true
        );
    }

    if (generatedItems.length === 0) {
        throw new Error('Could not generate a plan from your profile yet. Try updating equipment or goals.');
    }

    const dayCount = Math.min(7, Math.max(1, profile.days_per_week));
    const created = await createWorkoutPlanFromGeneratedPlan(
        {
            userId,
            name: buildPlanName(profile),
            description: buildPlanDescription(profile),
            muscleSlugs,
            difficulty,
            items: generatedItems,
            dayCount,
        },
        supabase
    );

    await addCardioAndStretchBlocks(created.id, profile, dayCount, supabase);

    await activateProgramForUser({
        userId,
        planId: created.id,
        trainingWeekdays: profile.training_weekdays,
        trainingLevel: profile.training_level,
        supabase,
    });

    const withExtras = await getWorkoutPlanWithItems(created.id, supabase);
    return withExtras ?? created;
}

/**
 * Adds a cardio block (if the profile's goals/training style call for it) and a stretch
 * cooldown to every day of a newly generated plan. Additive only — does not touch the
 * resistance-training item generation above.
 */
async function addCardioAndStretchBlocks(
    planId: string,
    profile: FitnessUserProfile,
    dayCount: number,
    supabase?: SupabaseClient
): Promise<void> {
    const wantsCardio =
        profile.goals.includes('better_cardio') || profile.preferred_training_style === 'cardio_focused';

    if (wantsCardio) {
        const cardioBlock = await generateCardioBlock({
            sessionDurationMinutes: profile.session_duration_minutes,
            supabase,
        });
        if (cardioBlock) {
            await addWorkoutPlanItem(
                planId,
                {
                    exerciseSlug: cardioBlock.exercise.slug,
                    day_index: dayCount,
                    category: 'cardio',
                    target_duration_seconds: cardioBlock.durationSeconds,
                    cardio_type: cardioBlock.cardioType,
                },
                supabase
            );
        }
    }

    const stretchItems = await generateStretchCooldown({ supabase, count: 2 });
    for (let day = 1; day <= dayCount; day++) {
        for (const stretchItem of stretchItems) {
            await addWorkoutPlanItem(
                planId,
                {
                    exerciseSlug: stretchItem.exercise.slug,
                    day_index: day,
                    category: 'stretch',
                    target_duration_seconds: stretchItem.durationSeconds,
                    target_rounds: stretchItem.rounds,
                },
                supabase
            );
        }
    }
}
