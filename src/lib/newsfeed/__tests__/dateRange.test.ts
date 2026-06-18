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

    it('uses a rolling 48-hour window for today', () => {
        const { startDate, endDate, isToday } = buildArticleDateRange('2026-06-17', now);
        expect(isToday).toBe(true);
        expect(endDate.getTime()).toBe(now.getTime());
        expect(endDate.getTime() - startDate.getTime()).toBe(48 * 60 * 60 * 1000);
    });

    it('uses the full local day for historical dates', () => {
        const { startDate, endDate, isToday } = buildArticleDateRange('2026-06-10', now);
        expect(isToday).toBe(false);
        expect(startDate.getHours()).toBe(0);
        expect(endDate.getHours()).toBe(23);
        expect(isSameLocalCalendarDay(startDate, parseLocalDateParam('2026-06-10'))).toBe(true);
    });

    it('builds a 7-day fallback window', () => {
        const { startDate, endDate } = buildFallbackDateRange(now);
        expect(endDate.getTime()).toBe(now.getTime());
        expect(endDate.getTime() - startDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
});
