import { buildOperationQueue, compareOperationOrder, type OperationHabit } from '../operationOrder';

function habit(partial: Partial<OperationHabit> & Pick<OperationHabit, 'id' | 'name'>): OperationHabit {
    return {
        icon: '•',
        time_of_day: 'morning',
        sort_order: 0,
        is_bad_habit: false,
        status: 'missed',
        ...partial,
    };
}

describe('compareOperationOrder', () => {
    it('orders morning before afternoon before evening before anytime', () => {
        const habits = [
            habit({ id: 'e', name: 'Bed', time_of_day: 'evening', sort_order: 0 }),
            habit({ id: 'a', name: 'Wake', time_of_day: 'morning', sort_order: 5 }),
            habit({ id: 'u', name: 'Anytime', time_of_day: null, sort_order: 0 }),
            habit({ id: 'p', name: 'Lunch', time_of_day: 'afternoon', sort_order: 0 }),
        ];
        expect(habits.slice().sort(compareOperationOrder).map((h) => h.id)).toEqual(['a', 'p', 'e', 'u']);
    });

    it('orders habits inside a day part by sort_order', () => {
        const habits = [
            habit({ id: 'stretch', name: 'Stretch', sort_order: 2 }),
            habit({ id: 'wake', name: 'Wake', sort_order: 0 }),
            habit({ id: 'water', name: 'Water', sort_order: 1 }),
        ];
        expect(habits.slice().sort(compareOperationOrder).map((h) => h.id)).toEqual(['wake', 'water', 'stretch']);
    });
});

describe('buildOperationQueue', () => {
    it('skips bad habits and points at the first unfinished step', () => {
        const queue = buildOperationQueue([
            habit({ id: 'wake', name: 'Wake', sort_order: 0, status: 'checked' }),
            habit({ id: 'smoke', name: 'Smoke', sort_order: 1, is_bad_habit: true }),
            habit({ id: 'water', name: 'Water', sort_order: 2, status: 'missed' }),
            habit({ id: 'lift', name: 'Lift', sort_order: 3, status: 'half' }),
        ]);

        expect(queue.steps.map((step) => step.id)).toEqual(['wake', 'water', 'lift']);
        expect(queue.now?.id).toBe('water');
        expect(queue.now?.step).toBe(2);
        expect(queue.completedCount).toBe(1);
    });

    it('returns no current step when every good habit is checked', () => {
        const queue = buildOperationQueue([
            habit({ id: 'wake', name: 'Wake', status: 'checked' }),
        ]);
        expect(queue.now).toBeNull();
        expect(queue.completedCount).toBe(1);
    });
});
