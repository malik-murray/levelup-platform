/**
 * Server-side read layer for the exercise catalog.
 * Uses Supabase; for RLS-protected usage, call from a context that provides an authenticated client.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    Equipment,
    ExerciseWithRelations,
    MuscleGroup,
    ExerciseDifficulty,
    ExerciseMovementPattern,
    ExerciseForceType,
    ExerciseMechanic,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Optional filters for getExercisesByFilters (slug-based and search). */
export interface ExerciseQueryFilters {
    muscleSlug?: string;
    equipmentSlug?: string;
    difficulty?: ExerciseDifficulty;
    movementPattern?: ExerciseMovementPattern;
    forceType?: ExerciseForceType;
    mechanic?: ExerciseMechanic;
    /** Filter by a single tag contained in exercise.tags */
    tag?: string;
    /** Optional future extension: filter by multiple tags (AND semantics) */
    tags?: string[];
    search?: string;
    /** Default true: only return published exercises. */
    publishedOnly?: boolean;
}

/** Row shape returned by Supabase for exercise + embedded relations (PostgREST). */
interface ExerciseRow {
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
    tags: string[];
    is_published: boolean;
    created_at: string;
    updated_at: string;
    primary_muscle_group?: MuscleGroup | null;
    equipment?: Equipment | null;
}

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

/** Select string for exercises with primary_muscle_group and equipment embedded. */
const EXERCISE_SELECT =
    '*, primary_muscle_group:muscle_groups!primary_muscle_group_id(id, name, slug, region, created_at), equipment:equipment!equipment_id(id, name, slug, created_at)';

function mapRowToExerciseWithRelations(row: ExerciseRow): ExerciseWithRelations {
    const { primary_muscle_group, equipment, ...rest } = row;
    return {
        ...rest,
        primary_muscle_group: primary_muscle_group ?? null,
        equipment: equipment ?? null,
    };
}

/**
 * Returns all exercises with primary muscle group and equipment.
 * Order: name ascending.
 */
export async function getAllExercises(
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('exercises')
        .select(EXERCISE_SELECT)
        .order('name', { ascending: true });

    if (error) {
        console.error('getAllExercises:', error);
        throw error;
    }
    return (data ?? []).map(mapRowToExerciseWithRelations);
}

/**
 * Returns only published exercises with relations.
 * Order: name ascending.
 */
export async function getPublishedExercises(
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('exercises')
        .select(EXERCISE_SELECT)
        .eq('is_published', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('getPublishedExercises:', error);
        throw error;
    }
    return (data ?? []).map(mapRowToExerciseWithRelations);
}

/**
 * Returns one exercise by slug with relations, or null if not found.
 */
export async function getExerciseBySlug(
    slug: string,
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations | null> {
    if (!slug?.trim()) return null;
    const client = getClient(supabase);
    const { data, error } = await client
        .from('exercises')
        .select(EXERCISE_SELECT)
        .eq('slug', slug.trim())
        .maybeSingle();

    if (error) {
        console.error('getExerciseBySlug:', error);
        throw error;
    }
    return data ? mapRowToExerciseWithRelations(data as ExerciseRow) : null;
}

/**
 * Returns a map of exercise_slug -> primary muscle slug for the given exercise slugs.
 * Only includes exercises that have a primary_muscle_group. V1 uses primary muscle only.
 */
export async function getPrimaryMuscleSlugsByExerciseSlugs(
    exerciseSlugs: string[],
    supabase?: SupabaseClient
): Promise<Record<string, string>> {
    const trimmed = exerciseSlugs.map((s) => s?.trim()).filter(Boolean);
    if (trimmed.length === 0) return {};
    const client = getClient(supabase);
    const { data, error } = await client
        .from('exercises')
        .select('slug, primary_muscle_group:muscle_groups!primary_muscle_group_id(slug)')
        .in('slug', trimmed);

    if (error) {
        console.error('getPrimaryMuscleSlugsByExerciseSlugs:', error);
        throw error;
    }
    const result: Record<string, string> = {};
    for (const row of data ?? []) {
        const r = row as {
            slug: string;
            primary_muscle_group: { slug: string } | { slug: string }[] | null;
        };
        const group = Array.isArray(r.primary_muscle_group)
            ? r.primary_muscle_group[0] ?? null
            : r.primary_muscle_group;
        if (group?.slug) {
            result[r.slug] = group.slug;
        }
    }
    return result;
}

/**
 * Returns a map of exercise_slug -> exercise.name for the given slugs.
 * Used to display human-readable names in plans and sessions.
 */
export async function getExerciseNamesBySlugs(
    slugs: string[],
    supabase?: SupabaseClient
): Promise<Record<string, string>> {
    const trimmed = slugs.map((s) => s?.trim()).filter(Boolean);
    if (trimmed.length === 0) return {};
    const client = getClient(supabase);
    const { data, error } = await client
        .from('exercises')
        .select('slug, name')
        .in('slug', trimmed);

    if (error) {
        console.error('getExerciseNamesBySlugs:', error);
        throw error;
    }
    const map: Record<string, string> = {};
    (data ?? []).forEach((row: { slug: string; name: string }) => {
        map[row.slug] = row.name;
    });
    return map;
}

/**
 * Formats a slug as a human-readable title (e.g. "bench-press" -> "Bench Press").
 * Fallback when exercise name cannot be resolved from the catalog.
 */
export function formatSlugAsTitle(slug: string): string {
    if (!slug?.trim()) return slug ?? '';
    return slug
        .trim()
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Returns published exercises whose primary muscle group has the given slug.
 * Includes relations. Order: name ascending.
 */
export async function getExercisesByPrimaryMuscle(
    slug: string,
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    if (!slug?.trim()) return [];
    const client = getClient(supabase);
    const { data: muscle } = await client
        .from('muscle_groups')
        .select('id')
        .eq('slug', slug.trim())
        .maybeSingle();

    if (!muscle?.id) return [];

    const { data, error } = await client
        .from('exercises')
        .select(EXERCISE_SELECT)
        .eq('primary_muscle_group_id', muscle.id)
        .eq('is_published', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('getExercisesByPrimaryMuscle:', error);
        throw error;
    }
    return (data ?? []).map(mapRowToExerciseWithRelations);
}

/**
 * Returns all muscle groups in a stable order: by region (upper, lower, core, full, other), then name.
 */
export async function getMuscleGroups(
    supabase?: SupabaseClient
): Promise<MuscleGroup[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('muscle_groups')
        .select('*')
        .order('region', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('getMuscleGroups:', error);
        throw error;
    }
    return data ?? [];
}

/**
 * Returns a single muscle group by slug, or null if not found.
 */
export async function getMuscleGroupBySlug(
    slug: string,
    supabase?: SupabaseClient
): Promise<MuscleGroup | null> {
    if (!slug?.trim()) return null;
    const client = getClient(supabase);
    const { data, error } = await client
        .from('muscle_groups')
        .select('*')
        .eq('slug', slug.trim())
        .maybeSingle();

    if (error) {
        console.error('getMuscleGroupBySlug:', error);
        throw error;
    }
    return (data as MuscleGroup) ?? null;
}

/**
 * Returns all equipment ordered by name ascending.
 */
export async function getEquipment(
    supabase?: SupabaseClient
): Promise<Equipment[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('equipment')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('getEquipment:', error);
        throw error;
    }
    return data ?? [];
}

/**
 * Returns exercises matching optional filters.
 * publishedOnly defaults to true. Slug filters use primary muscle group and equipment slugs.
 * search: case-insensitive match on name and short_description (when supported).
 */
export async function getExercisesByFilters(
    filters: ExerciseQueryFilters,
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    const client = getClient(supabase);
    const publishedOnly = filters.publishedOnly !== false;

    // Resolve slug filters to IDs in one shot
    let primaryMuscleId: string | null = null;
    let equipmentId: string | null = null;

    if (filters.muscleSlug?.trim()) {
        const { data: muscle } = await client
            .from('muscle_groups')
            .select('id')
            .eq('slug', filters.muscleSlug.trim())
            .maybeSingle();
        primaryMuscleId = muscle?.id ?? null;
    }
    if (filters.equipmentSlug?.trim()) {
        const { data: equip } = await client
            .from('equipment')
            .select('id')
            .eq('slug', filters.equipmentSlug.trim())
            .maybeSingle();
        equipmentId = equip?.id ?? null;
    }

    let query = client
        .from('exercises')
        .select(EXERCISE_SELECT)
        .order('name', { ascending: true });

    if (publishedOnly) {
        query = query.eq('is_published', true);
    }
    if (primaryMuscleId !== null) {
        query = query.eq('primary_muscle_group_id', primaryMuscleId);
    }
    if (equipmentId !== null) {
        query = query.eq('equipment_id', equipmentId);
    }
    if (filters.difficulty != null) {
        query = query.eq('difficulty', filters.difficulty);
    }
    if (filters.movementPattern != null) {
        query = query.eq('movement_pattern', filters.movementPattern);
    }
    if (filters.forceType != null) {
        query = query.eq('force_type', filters.forceType);
    }
    if (filters.mechanic != null) {
        query = query.eq('mechanic', filters.mechanic);
    }
    if (filters.tag && filters.tag.trim()) {
        query = query.contains('tags', [filters.tag.trim()]);
    } else if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
    }

    const { data, error } = await query;

    if (error) {
        console.error('getExercisesByFilters:', error);
        throw error;
    }

    let results = (data ?? []).map(mapRowToExerciseWithRelations);

    if (filters.search?.trim()) {
        const term = filters.search.trim().toLowerCase();
        results = results.filter((ex) => {
            const nameMatch = ex.name.toLowerCase().includes(term);
            const descMatch = ex.short_description?.toLowerCase().includes(term);
            return nameMatch || descMatch;
        });
    }

    return results;
}

// =============================================================================
// Saved exercises (favorites)
// =============================================================================

export async function listSavedExercises(
    supabase?: SupabaseClient
): Promise<ExerciseWithRelations[]> {
    const client = getClient(supabase);
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await client
        .from('fitness_saved_exercises')
        .select(
            `
            exercise:exercises (
                ${EXERCISE_SELECT}
            )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('listSavedExercises:', error);
        throw error;
    }

    const rows = (data ?? []) as unknown as { exercise: ExerciseRow | null }[];
    return rows
        .map((row) => (row.exercise ? mapRowToExerciseWithRelations(row.exercise) : null))
        .filter((ex): ex is ExerciseWithRelations => ex !== null);
}

export async function isExerciseSaved(
    exerciseId: string,
    supabase?: SupabaseClient
): Promise<boolean> {
    const client = getClient(supabase);
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
        return false;
    }

    const { data, error } = await client
        .from('fitness_saved_exercises')
        .select('id')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error('isExerciseSaved:', error);
        throw error;
    }

    return !!data;
}

export async function saveExercise(
    exerciseId: string,
    supabase?: SupabaseClient
): Promise<void> {
    const client = getClient(supabase);
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
        throw new Error('Not authenticated');
    }

    const { error } = await client.from('fitness_saved_exercises').insert({
        user_id: user.id,
        exercise_id: exerciseId,
    });

    if (error) {
        // Ignore unique violation (already saved)
        if ((error as any).code === '23505') {
            return;
        }
        console.error('saveExercise:', error);
        throw error;
    }
}

export async function unsaveExercise(
    exerciseId: string,
    supabase?: SupabaseClient
): Promise<void> {
    const client = getClient(supabase);
    const {
        data: { user },
        error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
        throw new Error('Not authenticated');
    }

    const { error } = await client
        .from('fitness_saved_exercises')
        .delete()
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId);

    if (error) {
        console.error('unsaveExercise:', error);
        throw error;
    }
}

