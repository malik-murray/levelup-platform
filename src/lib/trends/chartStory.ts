/**
 * Chart “stories” — peaks, dips, short takeaways. Sparse by design.
 */

export type ChartPointStory = {
    label: string;
    date: string;
    overall: number | null;
    habits: number | null;
    priorities: number | null;
    todos: number | null;
    morning: number | null;
    afternoon: number | null;
    evening: number | null;
    physical: number | null;
    mental: number | null;
    spiritual: number | null;
};

export function blendSpineScore(p: ChartPointStory): number | null {
    if (p.overall != null) return p.overall;
    const parts = [p.habits, p.priorities, p.todos].filter((x): x is number => x != null);
    if (parts.length === 0) return null;
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export type SpineAnnotation = {
    kind: 'peak' | 'trough';
    xLabel: string;
    y: number;
};

export type SpineStoryResult = {
    annotations: SpineAnnotation[];
    takeaway: string;
};

const SPINE_MIN_POINTS = 4;
const DROP_NOTE = 10;
const RISE_NOTE = 10;
const HALF_DELTA = 6;
const TAIL_DELTA = 5;

export function computeSpineStory(points: ChartPointStory[]): SpineStoryResult {
    const defined = points
        .map((p) => ({ label: p.label, v: blendSpineScore(p) }))
        .filter((x): x is { label: string; v: number } => x.v != null);

    if (defined.length < SPINE_MIN_POINTS) {
        return {
            annotations: [],
            takeaway:
                'A few more scored days in this window will surface clear highs, lows, and day-to-day moves on the spine.',
        };
    }

    let peak = defined[0];
    let trough = defined[0];
    for (const d of defined) {
        if (d.v > peak.v) peak = d;
        if (d.v < trough.v) trough = d;
    }

    let maxDrop = 0;
    let dropDay = '';
    let dropFrom = '';
    for (let i = 1; i < defined.length; i++) {
        const drop = defined[i - 1].v - defined[i].v;
        if (drop > maxDrop) {
            maxDrop = drop;
            dropDay = defined[i].label;
            dropFrom = defined[i - 1].label;
        }
    }

    let maxRise = 0;
    let riseDay = '';
    for (let i = 1; i < defined.length; i++) {
        const rise = defined[i].v - defined[i - 1].v;
        if (rise > maxRise) {
            maxRise = rise;
            riseDay = defined[i].label;
        }
    }

    const annotations: SpineAnnotation[] = [];
    if (peak.v !== trough.v || peak.label !== trough.label) {
        annotations.push({ kind: 'peak', xLabel: peak.label, y: peak.v });
        if (peak.label !== trough.label) {
            annotations.push({ kind: 'trough', xLabel: trough.label, y: trough.v });
        }
    }

    let takeaway = '';
    if (maxDrop >= DROP_NOTE && dropDay) {
        takeaway = `Sharpest single-day slip hit ${dropDay} — about ${Math.round(maxDrop)} pts under ${dropFrom}.`;
    } else if (maxRise >= RISE_NOTE && riseDay) {
        takeaway = `Strongest bounce landed on ${riseDay} — roughly +${Math.round(maxRise)} pts day over day.`;
    } else {
        takeaway = `High mark ${peak.label} (${peak.v}% blended). Low mark ${trough.label} (${trough.v}%).`;
    }

    const mid = Math.floor(defined.length / 2);
    const early = defined.slice(0, mid);
    const late = defined.slice(mid);
    const earlyAvg = early.reduce((s, x) => s + x.v, 0) / early.length;
    const lateAvg = late.reduce((s, x) => s + x.v, 0) / late.length;
    const halfSpread = Math.round(lateAvg - earlyAvg);
    if (Math.abs(halfSpread) >= HALF_DELTA && takeaway.length < 140) {
        if (halfSpread > 0) {
            takeaway += ` The back half averages ~${halfSpread} pts stronger.`;
        } else {
            takeaway += ` The first half averaged ~${Math.abs(halfSpread)} pts stronger.`;
        }
    }

    const last = defined[defined.length - 1];
    const prior = defined.slice(Math.max(0, defined.length - 4), defined.length - 1);
    const priorAvg = prior.length ? prior.reduce((s, x) => s + x.v, 0) / prior.length : last.v;
    const tail = Math.round(last.v - priorAvg);
    if (Math.abs(tail) >= TAIL_DELTA && takeaway.length < 200) {
        takeaway += tail > 0 ? ' Latest day sits above your prior few.' : ' Latest day trails your prior few.';
    }

    return { annotations: annotations.slice(0, 2), takeaway };
}

export function computeBarsRankStory(bars: { name: string; value: number }[]): string {
    if (bars.length < 2) return '';
    const sorted = [...bars].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top.value - bottom.value < 10) return 'These averages sit tight together — any small lift moves the board.';
    return `${top.name} prints highest here; ${bottom.name} is the lever with the most headroom.`;
}

export function computeMeansBundleTakeaway(
    core: { name: string; value: number }[],
    time: { name: string; value: number }[],
    lane: { name: string; value: number }[],
): string {
    const parts: string[] = [];
    const a = computeBarsRankStory(core);
    if (a) parts.push(a);
    const b = computeBarsRankStory(time);
    if (b && time.length >= 2) parts.push(b);
    const c = computeBarsRankStory(lane);
    if (c && lane.length >= 2) parts.push(c);
    return parts.slice(0, 2).join(' ');
}
