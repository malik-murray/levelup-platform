import { buildNowQueue } from '../nowQueue';
import type { OperationHabit } from '../operationOrder';
import type { FocusTask } from '../focusScore';

function habit(partial: Partial<OperationHabit> & Pick<OperationHabit, 'id' | 'name'>): OperationHabit {
    return {
        icon: '•',
        time_of_day: 'morning',
        sort_order: 0,
        status: 'missed',
        ...partial,
    };
}

function task(partial: Partial<FocusTask> & Pick<FocusTask, 'id' | 'title'>): FocusTask {
    return {
        is_important: true,
        is_urgent: true,
        due_date: null,
        ...partial,
    };
}

describe('buildNowQueue', () => {
    const day = '2026-10-25';

    it('puts overdue backlog work ahead of the morning routine', () => {
        const queue = buildNowQueue({
            day,
            part: 'morning',
            habits: [
                habit({ id: 'wake', name: 'Wake', sort_order: 0 }),
                habit({ id: 'lunch', name: 'Lunch', time_of_day: 'afternoon', sort_order: 1 }),
            ],
            tasks: [task({ id: 'report', title: 'Submit report', due_date: '2026-10-20', is_urgent: false })],
        });

        expect(queue.now).toMatchObject({ kind: 'task', id: 'report' });
        expect(queue.items.map((item) => item.id)).toEqual(['report', 'wake', 'lunch']);
    });

    it('keeps the next habit first when nothing is overdue, and slots due-today work after the current block', () => {
        const queue = buildNowQueue({
            day,
            part: 'morning',
            habits: [
                habit({ id: 'wake', name: 'Wake', sort_order: 0, status: 'checked' }),
                habit({ id: 'water', name: 'Water', sort_order: 1 }),
                habit({ id: 'dinner', name: 'Dinner', time_of_day: 'evening', sort_order: 2 }),
            ],
            tasks: [task({ id: 'call', title: 'Call client', due_date: day, is_urgent: false })],
        });

        expect(queue.now).toMatchObject({ kind: 'habit', id: 'water' });
        expect(queue.items.map((item) => item.id)).toEqual(['wake', 'water', 'call', 'dinner']);
    });
});
