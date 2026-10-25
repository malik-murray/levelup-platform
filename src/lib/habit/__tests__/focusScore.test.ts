import { daysUntilDue, focusScore, focusSummary, tasksForDay, type FocusTask } from '../focusScore';

function task(partial: Partial<FocusTask> & Pick<FocusTask, 'id'>): FocusTask {
    return {
        title: partial.id,
        is_important: false,
        is_urgent: false,
        due_date: null,
        ...partial,
    };
}

describe('focusScore', () => {
    const today = '2026-10-25';

    it('uses the tracker weights for priority and due date', () => {
        expect(focusScore(task({ id: 'p1-today', is_important: true, is_urgent: true, due_date: today }), today)).toBe(80);
        expect(focusScore(task({ id: 'p2-overdue', is_important: true, is_urgent: false, due_date: '2026-10-20' }), today)).toBe(80);
        expect(focusScore(task({ id: 'p1-soon', is_important: true, is_urgent: true, due_date: '2026-10-28' }), today)).toBe(65);
        expect(focusScore(task({ id: 'p1-week', is_important: true, is_urgent: true, due_date: '2026-11-01' }), today)).toBe(55);
        expect(focusScore(task({ id: 'p4-week', due_date: '2026-10-30' }), today)).toBe(25);
        expect(focusScore(task({ id: 'p3-none', is_important: false, is_urgent: true }), today)).toBe(20);
        expect(focusScore(task({ id: 'p1-later', is_important: true, is_urgent: true, due_date: '2026-11-20' }), today)).toBe(40);
    });

    it('adds follow-up points for blocked or waiting work and drops finished work', () => {
        expect(
            focusScore(
                task({ id: 'blocked', is_important: false, is_urgent: true, due_date: today, status: 'blocked' }),
                today
            )
        ).toBe(70);
        expect(focusScore(task({ id: 'done', completed_at: '2026-10-25T12:00:00Z' }), today)).toBeNull();
        expect(focusScore(task({ id: 'cancelled', status: 'cancelled' }), today)).toBeNull();
    });

    it('counts days until due without timezone drift', () => {
        expect(daysUntilDue('2026-10-25', today)).toBe(0);
        expect(daysUntilDue('2026-10-24', today)).toBe(-1);
        expect(daysUntilDue('2026-10-28', today)).toBe(3);
    });
});

describe('tasksForDay', () => {
    const today = '2026-10-25';

    it('pulls overdue, due soon, and do-first tasks ahead of later backlog', () => {
        const chosen = tasksForDay(
            [
                task({ id: 'later', is_important: true, is_urgent: true, due_date: '2026-12-01' }),
                task({ id: 'overdue', due_date: '2026-10-01' }),
                task({ id: 'q1', is_important: true, is_urgent: true }),
                task({ id: 'someday', is_important: false, is_urgent: false }),
                task({ id: 'week', due_date: '2026-10-30' }),
                    task({ id: 'done', due_date: today, completed_at: new Date(2026, 9, 25, 15, 0, 0).toISOString() }),
            ],
            today
        ).map((item) => item.id);

        expect(chosen).toContain('overdue');
        expect(chosen).toContain('q1');
        expect(chosen).toContain('week');
        expect(chosen).toContain('done');
        expect(chosen).not.toContain('later');
        expect(chosen).not.toContain('someday');
        expect(chosen.indexOf('done')).toBeGreaterThan(chosen.indexOf('overdue'));
    });

    it('summarizes the open backlog around today', () => {
        expect(
            focusSummary(
                [
                    task({ id: 'overdue', due_date: '2026-10-01' }),
                    task({ id: 'today', due_date: today }),
                    task({ id: 'week', due_date: '2026-10-30' }),
                    task({ id: 'done', due_date: today, completed_at: new Date(2026, 9, 25, 15, 0, 0).toISOString() }),
                ],
                today
            )
        ).toEqual({ open: 3, overdue: 1, dueToday: 1, dueNext7: 1 });
    });
});
