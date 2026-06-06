import type { TimeOfDay } from '@/lib/habitHelpers';
import type { SlotScore } from '@/lib/habit/computeDailyScores';

export function getDisplayFirstName(
    metadata: Record<string, unknown> | null | undefined
): string | null {
    if (!metadata) return null;
    for (const key of ['full_name', 'name', 'given_name', 'preferred_username'] as const) {
        const value = metadata[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim().split(/\s+/)[0] ?? null;
        }
    }
    return null;
}

function withName(firstName: string | null, message: string): string {
    if (!firstName) return message;
    return `${firstName} — ${message}`;
}

function slotLabel(slot: TimeOfDay): string {
    if (slot === 'morning') return 'Morning';
    if (slot === 'afternoon') return 'Afternoon';
    return 'Evening';
}

function pickVariant<T>(items: T[], seed: string): T {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash + seed.charCodeAt(i) * (i + 1)) % items.length;
    }
    return items[hash]!;
}

export function buildScoreRecapNotification(input: {
    slot: TimeOfDay;
    slotScore: SlotScore;
    scoreOverall: number;
    gradeOverall: string;
    firstName: string | null;
    dateStr: string;
}): { title: string; body: string } {
    const label = slotLabel(input.slot);
    const { score, grade, checked, total } = input.slotScore;
    const title = `${label} score: ${score}% (${grade})`;

    const seed = `${input.dateStr}:${input.slot}:${score}`;
    let body: string;

    if (score >= 90) {
        body = pickVariant(
            [
                `You checked in ${checked} of ${total} ${label.toLowerCase()} habits — that's ${score}%. Elite intention. Carry this energy into what's next.`,
                `${score}% this ${label.toLowerCase()} (${checked}/${total} habits). That's the standard. Stay sharp for the rest of today.`,
                `Crushed it: ${checked}/${total} ${label.toLowerCase()} habits, ${score}%. Your daily grade is ${input.gradeOverall}. Keep building.`,
            ],
            seed
        );
    } else if (score >= 60) {
        body = pickVariant(
            [
                `${label} came in at ${score}% (${checked}/${total} habits). Solid progress — pick one more win before the next block.`,
                `You're at ${score}% for ${label.toLowerCase()} (${checked}/${total}). Not perfect, but intentional. Stack one more habit today.`,
                `${checked} of ${total} ${label.toLowerCase()} habits done — ${score}%. You're building momentum. Daily score so far: ${input.scoreOverall}%.`,
            ],
            seed
        );
    } else {
        body = pickVariant(
            [
                `${label} landed at ${score}% (${checked}/${total} habits). No shame — reset now and finish one habit before you move on.`,
                `${score}% this ${label.toLowerCase()}. Today isn't over. Choose one habit and close the gap — your future self will feel it.`,
                `Only ${checked}/${total} ${label.toLowerCase()} habits checked in (${score}%). Be honest with yourself, then take one small action right now.`,
            ],
            seed
        );
    }

    return { title, body: withName(input.firstName, body) };
}

export function buildPlanTomorrowNotification(input: {
    firstName: string | null;
    dateStr: string;
    tomorrowDateStr: string;
    tomorrowPrioritiesCount: number;
    tomorrowTodosCount: number;
    todayScoreOverall: number;
    isWeekend: boolean;
}): { title: string; body: string } {
    const title = 'Plan tomorrow';
    const hasPlan = input.tomorrowPrioritiesCount > 0 || input.tomorrowTodosCount > 0;
    const seed = `${input.dateStr}:plan:${input.tomorrowPrioritiesCount}:${input.tomorrowTodosCount}`;

    let body: string;

    if (hasPlan && input.tomorrowPrioritiesCount >= 2) {
        body = pickVariant(
            [
                `You've already started tomorrow (${input.tomorrowPrioritiesCount} priorities set). Review tonight while today is fresh — adjust anything that shifted.`,
                `Tomorrow has a head start. Take 3 minutes to refine your priorities and to-dos before you shut down.`,
                `Good — tomorrow isn't blank. Polish the plan tonight so you wake up with clarity, not guesswork.`,
            ],
            seed
        );
    } else if (hasPlan) {
        body = pickVariant(
            [
                `Tomorrow's started but it's not complete. Add your top priorities and a short to-do list while you're still in today's context.`,
                `You began planning tomorrow — finish it tonight. Even 5 minutes of intention beats waking up reactive.`,
            ],
            seed
        );
    } else if (input.isWeekend) {
        body = pickVariant(
            [
                `Even on your off days, stay intentional. Map tomorrow's top 3 priorities before you unplug.`,
                `Rest matters — and so does direction. Take 5 minutes to plan tomorrow so Monday doesn't hijack you.`,
                `Slow evening? Perfect time to plan tomorrow. Your future self will thank you for the clarity.`,
            ],
            seed
        );
    } else if (input.todayScoreOverall >= 75) {
        body = pickVariant(
            [
                `Strong day (${input.todayScoreOverall}%). Close it with intention — plan tomorrow's priorities before you sign off.`,
                `You showed up today. Don't leave tomorrow to chance. Set your top 3 priorities tonight.`,
                `Even on your off days, stay intentional — and today you showed up. Plan tomorrow while the momentum is real.`,
            ],
            seed
        );
    } else {
        body = pickVariant(
            [
                `Even on your off days, stay intentional — here's your reminder to plan out tomorrow. Top 3 priorities. Short to-do list. Then rest.`,
                `Today was mixed — tomorrow can be clearer. Spend 5 minutes mapping priorities before bed.`,
                `Don't drift into tomorrow. Set your top 3 priorities tonight and wake up with a plan, not pressure.`,
            ],
            seed
        );
    }

    return { title, body: withName(input.firstName, body) };
}

export function addDaysToDateStr(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + days));
    return dt.toISOString().slice(0, 10);
}

function isWeekendInTimezone(timezone: string, now = new Date()): boolean {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
    }).format(now);
    return weekday === 'Sat' || weekday === 'Sun';
}
