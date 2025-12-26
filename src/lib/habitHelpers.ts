/**
 * Helper functions for habit tracker calculations and utilities
 */

export type HabitStatus = 'checked' | 'half' | 'missed';
export type Category = 'physical' | 'mental' | 'spiritual';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface DailyScore {
    overall: number;
    grade: string;
    score_habits: number; // 40% weight
    score_priorities: number; // 35% weight
    score_todos: number; // 25% weight
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
}

/**
 * Calculate score from habit status
 * checked = 1.0, half = 0.5, missed = 0.0
 */
export function getHabitStatusValue(status: HabitStatus): number {
    if (status === 'checked') return 1.0;
    if (status === 'half') return 0.5;
    return 0.0;
}

/**
 * Calculate score for a list of items (habits, priorities, todos)
 */
export function calculateItemScore(
    items: Array<{ status?: HabitStatus; completed?: boolean; is_done?: boolean }>,
    totalItems: number
): number {
    if (totalItems === 0) return 0;
    
    let points = 0;
    items.forEach(item => {
        if (item.status) {
            points += getHabitStatusValue(item.status);
        } else if (item.completed || item.is_done) {
            points += 1.0;
        }
    });
    
    return Math.round((points / totalItems) * 100);
}

/**
 * Calculate overall daily score
 * Habits: 40%, Priorities: 35%, Todos: 25%
 */
export function calculateDailyScore(
    habitsScore: number,
    prioritiesScore: number,
    todosScore: number
): number {
    return Math.round(
        habitsScore * 0.40 +
        prioritiesScore * 0.35 +
        todosScore * 0.25
    );
}

/**
 * Calculate category score (physical, mental, spiritual)
 */
export function calculateCategoryScore(
    items: Array<{ category?: Category; status?: HabitStatus; completed?: boolean; is_done?: boolean }>,
    targetCategory: Category,
    totalItemsInCategory: number
): number {
    if (totalItemsInCategory === 0) return 0;
    
    const categoryItems = items.filter(item => item.category === targetCategory);
    let points = 0;
    
    categoryItems.forEach(item => {
        if (item.status) {
            points += getHabitStatusValue(item.status);
        } else if (item.completed || item.is_done) {
            points += 1.0;
        }
    });
    
    return Math.round((points / totalItemsInCategory) * 100);
}

/**
 * Calculate time of day score (morning, afternoon, evening)
 */
export function calculateTimeOfDayScore(
    items: Array<{ time_of_day?: TimeOfDay; status?: HabitStatus; completed?: boolean; is_done?: boolean }>,
    targetTime: TimeOfDay,
    totalItemsInTime: number
): number {
    if (totalItemsInTime === 0) return 0;
    
    const timeItems = items.filter(item => item.time_of_day === targetTime);
    let points = 0;
    
    timeItems.forEach(item => {
        if (item.status) {
            points += getHabitStatusValue(item.status);
        } else if (item.completed || item.is_done) {
            points += 1.0;
        }
    });
    
    return Math.round((points / totalItemsInTime) * 100);
}

/**
 * Get letter grade from score
 */
export function getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

/**
 * Generate visual score display (🟩 = completed, ⬜ = missed)
 * Returns a string like "🟩🟩⬜⬜⬜" for 40% score
 */
export function getVisualScore(score: number, maxBlocks: number = 5): string {
    const filled = Math.round((score / 100) * maxBlocks);
    const empty = maxBlocks - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Get start and end of month for a given date
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
}

/**
 * Get all dates in a month
 */
export function getDatesInMonth(date: Date): Date[] {
    const { start, end } = getMonthRange(date);
    const dates: Date[] = [];
    const current = new Date(start);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}








