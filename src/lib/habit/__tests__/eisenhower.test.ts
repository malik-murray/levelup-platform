import {
    compareByQuadrant,
    getQuadrant,
    getQuadrantSortOrder,
    suggestClassification,
} from '../eisenhower';

describe('eisenhower', () => {
    it('maps boolean pairs to quadrants', () => {
        expect(getQuadrant({ is_important: true, is_urgent: true })).toBe('q1');
        expect(getQuadrant({ is_important: true, is_urgent: false })).toBe('q2');
        expect(getQuadrant({ is_important: false, is_urgent: true })).toBe('q3');
        expect(getQuadrant({ is_important: false, is_urgent: false })).toBe('q4');
        expect(getQuadrant({ is_important: null, is_urgent: true })).toBe('unclassified');
    });

    it('sorts Q1 before Q2 before unclassified', () => {
        const q1 = { is_important: true, is_urgent: true };
        const q2 = { is_important: true, is_urgent: false };
        const unknown = { is_important: null, is_urgent: null };
        expect(getQuadrantSortOrder(q1)).toBeLessThan(getQuadrantSortOrder(q2));
        expect(getQuadrantSortOrder(q2)).toBeLessThan(getQuadrantSortOrder(unknown));
    });

    it('compareByQuadrant uses secondary sort when quadrants match', () => {
        const a = { is_important: true, is_urgent: true, rank: 2 };
        const b = { is_important: true, is_urgent: true, rank: 1 };
        expect(
            compareByQuadrant(a, b, (x, y) => (x as typeof a).rank - (y as typeof b).rank)
        ).toBeGreaterThan(0);
    });

    it('suggests important from goal and urgent from due date', () => {
        expect(
            suggestClassification({
                goal_id: 'goal-1',
                due_date: '2026-06-19',
                today: '2026-06-19',
            })
        ).toEqual({ is_important: true, is_urgent: true });

        expect(
            suggestClassification({
                goal_id: null,
                due_date: '2026-06-25',
                today: '2026-06-19',
            })
        ).toEqual({ is_important: null, is_urgent: false });
    });
});
