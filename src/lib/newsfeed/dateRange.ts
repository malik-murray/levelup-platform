/** Format a Date as YYYY-MM-DD in the local timezone. */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseLocalDateParam(dateParam: string): Date {
    const [year, month, day] = dateParam.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export type ArticleDateRange = {
    startDate: Date;
    endDate: Date;
    isToday: boolean;
};

/**
 * Build the publish_time window for feed queries.
 * - Today / no date: rolling last 48 hours through now
 * - Historical dates: full local calendar day
 */
export function buildArticleDateRange(dateParam: string | null, now = new Date()): ArticleDateRange {
    if (!dateParam) {
        const endDate = new Date(now);
        const startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 48);
        return { startDate, endDate, isToday: true };
    }

    const targetDate = parseLocalDateParam(dateParam);
    const isToday = isSameLocalCalendarDay(targetDate, now);

    if (isToday) {
        const endDate = new Date(now);
        const startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 48);
        return { startDate, endDate, isToday: true };
    }

    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate, isToday: false };
}

/** Wider window used when today's feed has no matches. */
export function buildFallbackDateRange(now = new Date()): ArticleDateRange {
    const endDate = new Date(now);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    return { startDate, endDate, isToday: true };
}
