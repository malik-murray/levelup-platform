import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    ExerciseDifficulty,
    ExerciseMechanic,
    ExerciseMovementPattern,
    ExerciseWithRelations,
} from './types';
import { getAllExercises, getPublishedExercises } from './exercises';
import { MUSCLE_CONTENT } from '@/app/fitness/muscles/muscleContent';

export type GenerateWorkoutOptions = {
    muscleSlugs: string[];
    equipmentSlug?: string;
    difficulty?: ExerciseDifficulty;
    count?: number;
    publishedOnly?: boolean;
};

export type GeneratedWorkoutItem = {
    exercise: ExerciseWithRelations;
    sets: number;
    repRange: string;
    restSeconds: number;
    note?: string;
};

/**
 * Core selection logic: returns an ordered list of exercises only (no prescriptions).
 * Kept separate so we can layer prescriptions on top.
 */
export async function generateWorkoutFromCatalog(
    options: GenerateWorkoutOptions,
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    const {
        muscleSlugs,
        equipmentSlug,
        difficulty,
        count = 5,
        publishedOnly = true,
    } = options;

    // Load full catalog once, then filter in memory (catalog is small in v1).
    const allExercises = publishedOnly
        ? await getPublishedExercises(supabase)
        : await getAllExercises(supabase);

    // Filter by primary muscle group if provided
    let candidates = allExercises;
    if (muscleSlugs && muscleSlugs.length > 0) {
        const muscleSet = new Set(muscleSlugs);
        candidates = candidates.filter(
            (ex) => ex.primary_muscle_group && muscleSet.has(ex.primary_muscle_group.slug)
        );
    }

    // Filter by equipment
    if (equipmentSlug) {
        candidates = candidates.filter(
            (ex) => ex.equipment && ex.equipment.slug === equipmentSlug
        );
    }

    // Filter by difficulty
    if (difficulty) {
        candidates = candidates.filter(
            (ex) => ex.difficulty === difficulty
        );
    }

    if (candidates.length === 0) {
        return [];
    }

    // Build foundational exercise set from muscle config
    const foundationalSlugs = new Set<string>();
    for (const slug of muscleSlugs) {
        const content = MUSCLE_CONTENT[slug];
        if (!content) continue;
        content.foundationalExerciseSlugs.forEach((s) => foundationalSlugs.add(s));
    }

    // Basic weighting by movement pattern (for gentle variety / prioritization)
    const patternPriority: Record<ExerciseMovementPattern | 'other' | 'unknown', number> = {
        push: 1,
        pull: 1,
        squat: 1,
        hinge: 1,
        lunge: 1,
        carry: 2,
        rotation: 2,
        anti_rotation: 2,
        other: 3,
        unknown: 3,
    };

    const scored = candidates.map((ex) => {
        const isFoundational = foundationalSlugs.has(ex.slug);
        const patternKey: ExerciseMovementPattern | 'other' | 'unknown' =
            (ex.movement_pattern as ExerciseMovementPattern) ||
            (ex.movement_pattern === null ? 'unknown' : 'other');
        const patternScore = patternPriority[patternKey] ?? 3;

        // Lower score is better when sorting; foundational gets a strong boost.
        const score =
            (isFoundational ? 0 : 5) + // foundational first
            patternScore; // then by pattern

        return { ex, score, isFoundational };
    });

    scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        // Tie-break by name for stable ordering
        return a.ex.name.localeCompare(b.ex.name);
    });

    // Select up to count without duplicates
    const result: ExerciseWithRelations[] = [];
    const seen = new Set<string>();
    for (const { ex } of scored) {
        if (result.length >= count) break;
        if (seen.has(ex.id)) continue;
        seen.add(ex.id);
        result.push(ex);
    }

    return result;
}

/**
 * Returns a full workout plan: exercises + simple prescriptions (sets, reps, rest, note).
 */
export async function generateWorkoutPlanFromCatalog(
    options: GenerateWorkoutOptions,
    supabase?: SupabaseClient
): Promise<GeneratedWorkoutItem[]> {
    const exercises = await generateWorkoutFromCatalog(options, supabase);
    return exercises.map(ex => ({
        exercise: ex,
        ...getPrescriptionForExercise(ex),
    }));
}

function getPrescriptionForExercise(ex: ExerciseWithRelations): Omit<GeneratedWorkoutItem, 'exercise'> {
    const mechanic: ExerciseMechanic | null = ex.mechanic;
    const pattern: ExerciseMovementPattern | null = ex.movement_pattern;
    const difficulty: ExerciseDifficulty = ex.difficulty;

    // Classify into simple buckets
    const isCompoundPrimary =
        mechanic === 'compound' &&
        (pattern === 'squat' ||
            pattern === 'hinge' ||
            pattern === 'push' ||
            pattern === 'pull' ||
            pattern === 'lunge');

    const isCorePattern =
        (ex.primary_muscle_group?.slug === 'core') ||
        pattern === 'rotation' ||
        pattern === 'anti_rotation' ||
        ex.slug === 'plank' ||
        ex.slug === 'dead-bug' ||
        ex.slug === 'cable-woodchop' ||
        ex.slug === 'hanging-knee-raise' ||
        pattern === 'carry';

    const isIsolationOrAccessory =
        !isCompoundPrimary && !isCorePattern;

    // Base prescriptions
    if (isCorePattern) {
        if (difficulty === 'beginner') {
            return {
                sets: 2,
                repRange: '20–30 sec hold or 8–12 reps',
                restSeconds: 40,
                note: 'Focus on smooth breathing and maintaining position; stop well before form breaks.',
            };
        }
        if (difficulty === 'advanced') {
            return {
                sets: 4,
                repRange: '30–45 sec hold or 10–15 reps',
                restSeconds: 45,
                note: 'Use more challenging variations but maintain perfect trunk control.',
            };
        }
        // intermediate / all_levels
        return {
            sets: 3,
            repRange: '20–40 sec hold or 10–15 reps',
            restSeconds: 45,
            note: 'Keep tension through the midsection; prioritize quality over fatigue.',
        };
    }

    if (isCompoundPrimary) {
        if (difficulty === 'beginner') {
            return {
                sets: 3,
                repRange: '8–10 reps',
                restSeconds: 90,
                note: 'Use a load that allows 2–3 reps in reserve; focus on control and full range.',
            };
        }
        if (difficulty === 'advanced') {
            return {
                sets: 4,
                repRange: '5–8 reps',
                restSeconds: 120,
                note: 'Heavier loading with solid bracing; stay a couple of reps away from failure.',
            };
        }
        // intermediate / all_levels
        return {
            sets: 3,
            repRange: '6–10 reps',
            restSeconds: 105,
            note: 'Controlled tempo and full ROM; avoid grinding reps to failure.',
        };
    }

    // Isolation / accessory
    if (difficulty === 'beginner') {
        return {
            sets: 2,
            repRange: '10–15 reps',
            restSeconds: 60,
            note: 'Moderate load with smooth reps; slight burn is okay, sharp pain is not.',
        };
    }
    if (difficulty === 'advanced') {
        return {
            sets: 4,
            repRange: '8–12 reps',
            restSeconds: 75,
            note: 'Control the eccentric and use a strong squeeze at peak contraction.',
        };
    }
    // intermediate / all_levels
    return {
        sets: 3,
        repRange: '10–15 reps',
        restSeconds: 60,
        note: 'Use a weight you can move cleanly while feeling the target muscle throughout.',
    };
}


