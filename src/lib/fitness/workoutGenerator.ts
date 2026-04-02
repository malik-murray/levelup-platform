import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    ExerciseDifficulty,
    ExerciseMovementPattern,
    ExerciseWithRelations,
} from './types';
import { getAllExercises, getPublishedExercises } from './exercises';
import { MUSCLE_CONTENT } from '@/app/fitness/muscles/muscleContent';

/** User-selected difficulty for V1 workout generator. */
export type WorkoutDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type GenerateWorkoutOptions = {
    muscleSlugs: string[];
    equipmentSlug?: string;
    difficulty?: ExerciseDifficulty;
    count?: number;
    publishedOnly?: boolean;
};

/** Single exercise with sets/reps prescription. */
export type GeneratedWorkoutItem = {
    exercise: ExerciseWithRelations;
    sets: number;
    repRange: string;
    restSeconds: number;
    note?: string;
};

/** V1 workout generator output: 4–6 exercises with prescriptions. */
export type GeneratedWorkout = {
    exercises: GeneratedWorkoutItem[];
};

/**
 * V1 rule-based workout generator.
 * Input: single muscle, required difficulty, optional equipment.
 * Output: 4–6 exercises with basic sets/reps guidance.
 */
export async function generateWorkout(options: {
    muscleSlug: string;
    difficulty: WorkoutDifficulty;
    equipmentSlug?: string;
    supabase?: SupabaseClient;
}): Promise<GeneratedWorkout> {
    const { muscleSlug, difficulty, equipmentSlug, supabase } = options;

    const items = await generateWorkoutPlanFromCatalog(
        {
            muscleSlugs: [muscleSlug],
            equipmentSlug,
            difficulty: difficulty as ExerciseDifficulty,
            count: 6, // will be clamped to 4–6 by selection logic
            publishedOnly: true,
        },
        supabase,
        difficulty,
        true // use tag-based selection + allow <= difficulty
    );

    return { exercises: items };
}

/** Tag priority for selection: lower = higher priority. */
const TAG_PRIORITY: Record<string, number> = {
    compound: 0,
    strength: 1,
    hypertrophy: 2,
    isolation: 3,
    endurance: 4,
    mobility: 5,
    stretching: 6,
};

function getTagPriority(ex: ExerciseWithRelations): number {
    const tags = ex.tags ?? [];
    let best = 99;
    for (const tag of tags) {
        const p = TAG_PRIORITY[tag.toLowerCase()];
        if (p !== undefined && p < best) best = p;
    }
    return best;
}

/** Fisher–Yates shuffle for slight variety within same-priority groups. */
function shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Difficulty ordering: exercises with difficulty <= user level are allowed. */
const DIFFICULTY_ORDER: ExerciseDifficulty[] = ['beginner', 'intermediate', 'advanced', 'all_levels'];

function isDifficultyAllowed(exDifficulty: ExerciseDifficulty, userDifficulty: WorkoutDifficulty): boolean {
    if (exDifficulty === 'all_levels') return true;
    const userIdx = DIFFICULTY_ORDER.indexOf(userDifficulty as ExerciseDifficulty);
    const exIdx = DIFFICULTY_ORDER.indexOf(exDifficulty);
    return exIdx >= 0 && exIdx <= userIdx;
}

/**
 * Core selection logic: returns an ordered list of exercises only (no prescriptions).
 * Kept separate so we can layer prescriptions on top.
 */
export async function generateWorkoutFromCatalog(
    options: GenerateWorkoutOptions,
    supabase?: SupabaseClient,
    userDifficulty?: WorkoutDifficulty,
    useTagBasedSelection = false
): Promise<ExerciseWithRelations[]> {
    const {
        muscleSlugs,
        equipmentSlug,
        difficulty,
        count = 5,
        publishedOnly = true,
    } = options;

    const targetCount = Math.min(6, Math.max(4, count));

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
        if (useTagBasedSelection && userDifficulty) {
            candidates = candidates.filter((ex) => isDifficultyAllowed(ex.difficulty, userDifficulty));
        } else {
            candidates = candidates.filter((ex) => ex.difficulty === difficulty);
        }
    }

    if (candidates.length === 0) {
        return [];
    }

    if (useTagBasedSelection) {
        // Tag-based: compound first, strength/hypertrophy, isolation, others.
        // Shuffle within same-priority groups for variety.
        const byPriority = new Map<number, ExerciseWithRelations[]>();
        for (const ex of candidates) {
            const p = getTagPriority(ex);
            const list = byPriority.get(p) ?? [];
            list.push(ex);
            byPriority.set(p, list);
        }
        const sortedPriorities = [...byPriority.keys()].sort((a, b) => a - b);
        const result: ExerciseWithRelations[] = [];
        const seen = new Set<string>();
        for (const p of sortedPriorities) {
            if (result.length >= targetCount) break;
            let list = byPriority.get(p) ?? [];
            list = shuffle(list);
            for (const ex of list) {
                if (result.length >= targetCount) break;
                if (seen.has(ex.id)) continue;
                seen.add(ex.id);
                result.push(ex);
            }
        }
        return result;
    }

    // Legacy: foundational + movement pattern
    const foundationalSlugs = new Set<string>();
    for (const slug of muscleSlugs) {
        const content = MUSCLE_CONTENT[slug];
        if (!content) continue;
        content.foundationalExerciseSlugs.forEach((s) => foundationalSlugs.add(s));
    }

    const patternPriority: Record<ExerciseMovementPattern | 'other' | 'unknown', number> = {
        push: 1, pull: 1, squat: 1, hinge: 1, lunge: 1,
        carry: 2, rotation: 2, anti_rotation: 2,
        other: 3, unknown: 3,
    };

    const scored = candidates.map((ex) => {
        const isFoundational = foundationalSlugs.has(ex.slug);
        const patternKey: ExerciseMovementPattern | 'other' | 'unknown' =
            (ex.movement_pattern as ExerciseMovementPattern) || (ex.movement_pattern === null ? 'unknown' : 'other');
        const patternScore = patternPriority[patternKey] ?? 3;
        const score = (isFoundational ? 0 : 5) + patternScore;
        return { ex, score };
    });

    scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.ex.name.localeCompare(b.ex.name);
    });

    const result: ExerciseWithRelations[] = [];
    const seen = new Set<string>();
    for (const { ex } of scored) {
        if (result.length >= targetCount) break;
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
    supabase?: SupabaseClient,
    userDifficulty?: WorkoutDifficulty,
    useTagBasedSelection = false
): Promise<GeneratedWorkoutItem[]> {
    const exercises = await generateWorkoutFromCatalog(
        options,
        supabase,
        userDifficulty,
        useTagBasedSelection
    );
    return exercises.map((ex) => ({
        exercise: ex,
        ...getPrescriptionForExercise(ex, userDifficulty),
    }));
}

/**
 * V1 sets/reps rules by user difficulty:
 * - Beginner: 2–3 sets, 8–12 reps
 * - Intermediate: 3–4 sets, 6–12 reps
 * - Advanced: 4–5 sets, 5–12 reps
 * Tag tweaks: strength → 5–8, hypertrophy → 8–12, endurance → 12–20
 */
function getPrescriptionForExercise(
    ex: ExerciseWithRelations,
    userDifficulty?: WorkoutDifficulty
): Omit<GeneratedWorkoutItem, 'exercise'> {
    const difficulty = (userDifficulty ?? ex.difficulty) as WorkoutDifficulty | 'all_levels';
    const tags = (ex.tags ?? []).map((t) => t.toLowerCase());

    // Base sets/reps by difficulty
    let sets: number;
    let repRange: string;
    let restSeconds: number;

    if (difficulty === 'beginner') {
        sets = 3;
        repRange = '8–12 reps';
        restSeconds = 60;
    } else if (difficulty === 'intermediate') {
        sets = 3;
        repRange = '6–12 reps';
        restSeconds = 90;
    } else if (difficulty === 'advanced') {
        sets = 4;
        repRange = '5–12 reps';
        restSeconds = 105;
    } else {
        sets = 3;
        repRange = '8–12 reps';
        restSeconds = 75;
    }

    // Tag-based rep tweaks (keep simple)
    if (tags.includes('strength')) {
        repRange = '5–8 reps';
    } else if (tags.includes('hypertrophy')) {
        repRange = '8–12 reps';
    } else if (tags.includes('endurance')) {
        repRange = '12–20 reps';
    }

    // Core patterns: use time-based for holds
    const pattern: ExerciseMovementPattern | null = ex.movement_pattern;
    const isCorePattern =
        (ex.primary_muscle_group?.slug === 'core') ||
        pattern === 'rotation' ||
        pattern === 'anti_rotation' ||
        ['plank', 'dead-bug', 'cable-woodchop', 'hanging-knee-raise'].includes(ex.slug ?? '') ||
        pattern === 'carry';

    if (isCorePattern) {
        repRange = difficulty === 'beginner'
            ? '20–30 sec hold or 8–12 reps'
            : difficulty === 'advanced'
              ? '30–45 sec hold or 10–15 reps'
              : '20–40 sec hold or 10–15 reps';
    }

    return {
        sets,
        repRange,
        restSeconds,
    };
}


