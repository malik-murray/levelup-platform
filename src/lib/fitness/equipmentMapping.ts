import type { FitnessEquipmentAccess } from './profile';

/**
 * Maps a user's onboarding equipment answers to the `equipment` table's slugs
 * (seeded in supabase/migrations/037_seed_exercises.sql). `full_gym` and `other`
 * have no single equivalent — they mean "unrestricted," represented as `null`.
 * `cardio_machines` has no matching seed row yet, so it resolves to no slugs
 * (contributes nothing to the filter rather than blocking generation).
 */
const EQUIPMENT_ACCESS_TO_SLUGS: Record<FitnessEquipmentAccess, string[] | null> = {
    bodyweight: ['bodyweight'],
    dumbbells: ['dumbbell'],
    barbell: ['barbell'],
    machines: ['machine', 'cable'],
    resistance_bands: ['resistance-band'],
    kettlebells: ['kettlebell'],
    pull_up_bar: ['pull-up-bar'],
    cardio_machines: [],
    full_gym: null,
    other: null,
};

/**
 * Resolves a profile's equipment access into a flat list of allowed equipment
 * slugs for filtering generated workouts. Returns `undefined` (unrestricted)
 * when the user has `full_gym`/`other` access, or when the array is empty
 * (defensively treated as bodyweight-only, since the profile form otherwise
 * requires at least one equipment selection).
 */
export function resolveEquipmentSlugsForAccess(
    equipmentAccess: FitnessEquipmentAccess[]
): string[] | undefined {
    if (equipmentAccess.length === 0) {
        return EQUIPMENT_ACCESS_TO_SLUGS.bodyweight ?? undefined;
    }

    const slugs = new Set<string>();
    for (const access of equipmentAccess) {
        const mapped = EQUIPMENT_ACCESS_TO_SLUGS[access];
        if (mapped === null) {
            // full_gym/other present anywhere in the selection means unrestricted.
            return undefined;
        }
        mapped.forEach((slug) => slugs.add(slug));
    }

    return [...slugs];
}
