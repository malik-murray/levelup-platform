import { formatDate } from '@/lib/habitHelpers';

export type TrendsPeriodPreset = 'weekly' | 'monthly' | 'custom';

export const TRENDS_MAX_CUSTOM_DAYS = 365;

export function todayLocal(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export function addDays(base: Date, delta: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + delta);
    return d;
}

export function parseLocalYmd(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    const d = new Date(y, mo, day);
    if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
    return d;
}

export function daysInclusive(start: Date, end: Date): number {
    const a = new Date(start);
    a.setHours(0, 0, 0, 0);
    const b = new Date(end);
    b.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

export type ResolvedTrendsRange = {
    startDateStr: string;
    endDateStr: string;
    totalDays: number;
    rangeInvalid: boolean;
    rangeTooLong: boolean;
};

function fallbackWeek(endBase: Date): ResolvedTrendsRange {
    const start = addDays(endBase, -6);
    return {
        startDateStr: formatDate(start),
        endDateStr: formatDate(endBase),
        totalDays: 7,
        rangeInvalid: true,
        rangeTooLong: false,
    };
}

export function resolveTrendsDateRange(
    preset: TrendsPeriodPreset,
    customStart: string,
    customEnd: string,
): ResolvedTrendsRange {
    const endBase = todayLocal();
    if (preset === 'weekly') {
        const start = addDays(endBase, -6);
        return {
            startDateStr: formatDate(start),
            endDateStr: formatDate(endBase),
            totalDays: 7,
            rangeInvalid: false,
            rangeTooLong: false,
        };
    }
    if (preset === 'monthly') {
        const start = addDays(endBase, -29);
        return {
            startDateStr: formatDate(start),
            endDateStr: formatDate(endBase),
            totalDays: 30,
            rangeInvalid: false,
            rangeTooLong: false,
        };
    }
    const s = parseLocalYmd(customStart);
    const e = parseLocalYmd(customEnd);
    if (!s || !e || s > e || s > endBase) {
        return fallbackWeek(endBase);
    }
    const cappedEnd = e > endBase ? endBase : e;
    if (s > cappedEnd) {
        return fallbackWeek(endBase);
    }
    const span = daysInclusive(s, cappedEnd);
    if (span > TRENDS_MAX_CUSTOM_DAYS) {
        return { ...fallbackWeek(endBase), rangeTooLong: true };
    }
    return {
        startDateStr: formatDate(s),
        endDateStr: formatDate(cappedEnd),
        totalDays: span,
        rangeInvalid: false,
        rangeTooLong: false,
    };
}

export function enumerateDateKeysInclusive(startStr: string, endStr: string): string[] {
    const s = parseLocalYmd(startStr);
    const e = parseLocalYmd(endStr);
    if (!s || !e || s > e) return [];
    const keys: string[] = [];
    for (let cur = new Date(s.getTime()); cur.getTime() <= e.getTime(); cur = addDays(cur, 1)) {
        keys.push(formatDate(cur));
    }
    return keys;
}

export function priorWindowSameLength(
    currentStartStr: string,
    totalDays: number,
): { priorStartStr: string; priorEndStr: string } | null {
    const start = parseLocalYmd(currentStartStr);
    if (!start || totalDays < 1) return null;
    const priorEnd = addDays(start, -1);
    const priorStart = addDays(priorEnd, -(totalDays - 1));
    return {
        priorStartStr: formatDate(priorStart),
        priorEndStr: formatDate(priorEnd),
    };
}
