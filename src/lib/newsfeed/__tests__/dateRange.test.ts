import {
    buildArticleDateRange,
    buildFallbackDateRange,
    formatLocalDate,
    isSameLocalCalendarDay,
    parseLocalDateParam,
} from '@/lib/newsfeed/dateRange';

describe('newsfeed dateRange', () => {
    const now = new Date(2026, 5, 17, 15, 30, 0);

    it('formats local calendar dates', () => {
        expect(formatLocalDate(new Date(2026, 5, 17))).toBe('2026-06-17');
    });

    it('parses YYYY-MM-DD as local midnight', () => {
        const parsed = parseLocalDateParam('2026-06-17');
        expect(parsed.getFullYear()).toBe(2026);
        expect(parsed.getMonth()).toBe(5);
        expect(parsed.getDate()).toBe(17);
        expect(parsed.getHours()).toBe(0);
    });

    it('uses the local calendar day for today', () => {
        const { startDate, endDate, isToday } = buildArticleDateRange('2026-06-17', now);
        expect(isToday).toBe(true);
        expect(startDate.getHours()).toBe(0);
        expect(startDate.getMinutes()).toBe(0);
        expect(endDate.getHours()).toBe(23);
        expect(endDate.getMinutes()).toBe(59);
        expect(isSameLocalCalendarDay(startDate, parseLocalDateParam('2026-06-17'))).toBe(true);
    });

    it('uses the full local day for historical dates', () => {
        const { startDate, endDate, isToday } = buildArticleDateRange('2026-06-10', now);
        expect(isToday).toBe(false);
        expect(startDate.getHours()).toBe(0);
        expect(endDate.getHours()).toBe(23);
        expect(isSameLocalCalendarDay(startDate, parseLocalDateParam('2026-06-10'))).toBe(true);
    });

    it('builds a yesterday fallback window', () => {
        const { startDate, endDate } = buildFallbackDateRange(now);
        expect(startDate.getDate()).toBe(16);
        expect(endDate.getDate()).toBe(16);
        expect(startDate.getHours()).toBe(0);
        expect(endDate.getHours()).toBe(23);
    });
});
