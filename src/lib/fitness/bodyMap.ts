import type {
    BodyView,
    BodyRegionId,
    BodyRegionConfig,
} from '@/app/fitness/exercises/components/bodyMapConfig';
import {
    FRONT_REGIONS,
    BACK_REGIONS,
} from '@/app/fitness/exercises/components/bodyMapConfig';

export type { BodyView, BodyRegionId, BodyRegionConfig };

export const BODY_MAP_FRONT_REGIONS = FRONT_REGIONS;
export const BODY_MAP_BACK_REGIONS = BACK_REGIONS;

export function getAllBodyMapRegions(): BodyRegionConfig[] {
    return [...FRONT_REGIONS, ...BACK_REGIONS];
}

export function getRegionLabelForMuscleSlug(slug: string): string | null {
    const region = getAllBodyMapRegions().find((r) => r.muscleSlug === slug);
    return region ? region.label : null;
}

// =============================================================================
// Recent muscles (client-side only - localStorage helpers)
// =============================================================================

const RECENT_MUSCLES_KEY = 'fitness_recent_muscles';
const RECENT_MUSCLES_LIMIT = 5;

export function loadRecentMuscles(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(RECENT_MUSCLES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v) => typeof v === 'string');
    } catch {
        return [];
    }
}

export function addRecentMuscle(slug: string): void {
    if (typeof window === 'undefined') return;
    try {
        const current = loadRecentMuscles();
        const without = current.filter((s) => s !== slug);
        const next = [slug, ...without].slice(0, RECENT_MUSCLES_LIMIT);
        window.localStorage.setItem(RECENT_MUSCLES_KEY, JSON.stringify(next));
    } catch {
        // ignore storage errors
    }
}

export function clearRecentMuscles(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(RECENT_MUSCLES_KEY);
    } catch {
        // ignore
    }
}


