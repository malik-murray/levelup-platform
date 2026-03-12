'use client';

export type DashboardScores = {
    score_overall: number;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
};

const BAR_CONFIG = [
    { key: 'score_overall' as const, label: 'Overall Score', color: 'from-amber-500 to-amber-400', trackBg: 'bg-amber-950/40', textColor: 'text-amber-400' },
    { key: 'score_priorities' as const, label: 'Priority Score', color: 'from-purple-500 to-purple-400', trackBg: 'bg-purple-950/40', textColor: 'text-purple-400' },
    { key: 'score_habits' as const, label: 'Habit Score', color: 'from-blue-500 to-blue-400', trackBg: 'bg-blue-950/40', textColor: 'text-blue-400' },
    { key: 'score_todos' as const, label: 'To-Do List Score', color: 'from-emerald-500 to-emerald-400', trackBg: 'bg-emerald-950/40', textColor: 'text-emerald-400' },
] as const;

export default function DashboardScoreBars({ scores }: { scores: DashboardScores | null }) {
    if (!scores) {
        return (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3">
                {BAR_CONFIG.map(({ key, label, trackBg, textColor }) => (
                    <div key={key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">{label}</span>
                            <span className="text-xs font-mono text-slate-500">—%</span>
                        </div>
                        <div className={`relative h-7 rounded-lg overflow-hidden border border-slate-700/50 ${trackBg}`}>
                            <div className="absolute inset-y-0 right-0 w-3 flex items-stretch finish-line rounded-r-lg" aria-hidden />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3">
            {BAR_CONFIG.map(({ key, label, color, trackBg, textColor }) => {
                const value = scores[key];
                const pct = Math.min(100, Math.max(0, value));
                return (
                    <div key={key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">{label}</span>
                            <span className={`text-sm font-bold tabular-nums ${textColor}`}>{pct}%</span>
                        </div>
                        <div className={`relative h-7 rounded-lg overflow-hidden border border-slate-700/50 ${trackBg}`}>
                            <div
                                className={`absolute inset-y-0 left-0 rounded-l-lg bg-gradient-to-r ${color} transition-all duration-500 ease-out`}
                                style={{ width: `${pct}%` }}
                            />
                            <div
                                className="absolute inset-y-0 right-0 w-3 flex items-stretch finish-line rounded-r-lg"
                                aria-hidden
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
