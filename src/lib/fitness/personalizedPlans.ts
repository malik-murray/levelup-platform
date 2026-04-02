import type { SupabaseClient } from '@supabase/supabase-js';
import type { FitnessUserProfile } from './profile';
import { generateWorkoutPlanFromCatalog, type WorkoutDifficulty } from './workoutGenerator';
import { createWorkoutPlanFromGeneratedPlan, listWorkoutPlansForUser, type WorkoutPlanWithItems } from './workoutPlans';
import { activateProgramForUser } from './programEngine';

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
    const generatedItems = await generateWorkoutPlanFromCatalog(
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

    if (generatedItems.length === 0) {
        throw new Error('Could not generate a plan from your profile yet. Try updating equipment or goals.');
    }

    const created = await createWorkoutPlanFromGeneratedPlan(
        {
            userId,
            name: buildPlanName(profile),
            description: buildPlanDescription(profile),
            muscleSlugs,
            difficulty,
            items: generatedItems,
            dayCount: Math.min(7, Math.max(1, profile.days_per_week)),
        },
        supabase
    );
    await activateProgramForUser({
        userId,
        planId: created.id,
        trainingWeekdays: profile.training_weekdays,
        trainingLevel: profile.training_level,
        supabase,
    });
    return created;
}
