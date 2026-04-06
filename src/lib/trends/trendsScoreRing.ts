/** Stroke color for a 0–100 score tier (brighter = stronger). */
export function scoreTierColor(percent: number): string {
    if (percent >= 90) return '#4ade80';
    if (percent >= 80) return '#a3e635';
    if (percent >= 70) return '#facc15';
    if (percent >= 60) return '#fb923c';
    return '#f87171';
}
