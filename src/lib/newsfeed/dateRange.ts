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

function buildLocalCalendarDayRange(targetDate: Date): ArticleDateRange {
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate, isToday: false };
}

/**
 * Build the publish_time window for feed queries.
 * - Today / no date: local calendar day (midnight through end of day)
 * - Historical dates: full local calendar day
 */
export function buildArticleDateRange(dateParam: string | null, now = new Date()): ArticleDateRange {
    const targetDate = dateParam ? parseLocalDateParam(dateParam) : now;
    const isToday = isSameLocalCalendarDay(targetDate, now);
    const range = buildLocalCalendarDayRange(targetDate);
    return { ...range, isToday };
}

/** Previous calendar day, used when today's feed has no matches. */
export function buildFallbackDateRange(now = new Date()): ArticleDateRange {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return buildLocalCalendarDayRange(yesterday);
}
