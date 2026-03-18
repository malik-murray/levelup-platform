/**
 * Fitness module types: exercise catalog (MuscleWiki-style foundation).
 * Aligned with supabase/migrations/036_exercise_database.sql.
 * Used by lib/fitness queries and (future) API routes and UI.
 */

// =============================================================================
// Controlled vocabularies (match DB CHECK constraints)
// =============================================================================

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export type ExerciseMovementPattern =
    | 'push'
    | 'pull'
    | 'squat'
    | 'hinge'
    | 'lunge'
    | 'carry'
    | 'rotation'
    | 'anti_rotation'
    | 'other';

export type ExerciseForceType = 'push' | 'pull' | 'static' | 'other';

export type ExerciseMechanic = 'compound' | 'isolation' | 'other';

export type MuscleGroupRegion = 'upper' | 'lower' | 'core' | 'full' | 'other';

// =============================================================================
// Domain entities (match DB tables)
// =============================================================================

export interface MuscleGroup {
    id: string;
    name: string;
    slug: string;
    region: MuscleGroupRegion;
    created_at: string;
}

export interface Equipment {
    id: string;
    name: string;
    slug: string;
    created_at: string;
}

export interface Exercise {
    id: string;
    slug: string;
    name: string;
    primary_muscle_group_id: string | null;
    secondary_muscle_group_ids: string[];
    equipment_id: string | null;
    difficulty: ExerciseDifficulty;
    movement_pattern: ExerciseMovementPattern | null;
    force_type: ExerciseForceType | null;
    mechanic: ExerciseMechanic | null;
    short_description: string | null;
    instructions: string[];
    tips: string[];
    common_mistakes: string[];
    media_url: string | null;
    thumbnail_url: string | null;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}

/** Exercise with optional embedded muscle_group and equipment (for list/detail views) */
export interface ExerciseWithRelations extends Exercise {
    primary_muscle_group?: MuscleGroup | null;
    equipment?: Equipment | null;
    secondary_muscle_groups?: MuscleGroup[];
}

// =============================================================================
// Filter shapes (for queries / API)
// =============================================================================

export interface ExerciseFilters {
    /** Only published exercises (default true for public listing) */
    is_published?: boolean;
    /** Filter by primary muscle group id */
    primary_muscle_group_id?: string;
    /** Include exercises that target this muscle (primary or secondary) */
    muscle_group_id?: string;
    /** Filter by equipment id */
    equipment_id?: string;
    difficulty?: ExerciseDifficulty | ExerciseDifficulty[];
    movement_pattern?: ExerciseMovementPattern | ExerciseMovementPattern[];
    force_type?: ExerciseForceType | ExerciseForceType[];
    mechanic?: ExerciseMechanic | ExerciseMechanic[];
    /** Text search on name, short_description (implementation-dependent) */
    search?: string;
    /** Pagination / list limits */
    limit?: number;
    offset?: number;
}
