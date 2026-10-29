'use client';

import type { Category, HabitStatus } from '@/lib/habitHelpers';
import { buildOperationQueue, timeOfDayLabel, type OperationHabit } from '@/lib/habit/operationOrder';

type SequenceHabit = OperationHabit & {
    category: Category;
    categories?: Category[];
    status: HabitStatus;
    checked_at: string | null;
};

const CATEGORY_COLORS: Record<Category, string> = {
    physical: 'bg-blue-500/30 text-blue-300 border-blue-500/50',
    mental: 'bg-purple-500/30 text-purple-300 border-purple-500/50',
    spiritual: 'bg-amber-500/30 text-amber-300 border-amber-500/50',
};

function completedLabel(ts: string | null): string | null {
    if (!ts) return null;
    return new Date(ts)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        .toLowerCase()
        .replace(' ', '');
}

export default function OperationSequence({
    habits,
    onToggle,
    skippedIds = [],
    onSkip,
    onClearSkips,
    mode = 'both',
}: {
    habits: SequenceHabit[];
    onToggle: (habitId: string) => void;
    skippedIds?: string[];
    onSkip?: (habitId: string) => void;
    onClearSkips?: () => void;
    mode?: 'card' | 'list' | 'both';
}) {
    const skipped = new Set(skippedIds);
    const { steps, now, completedCount, skippedOpenCount } = buildOperationQueue(habits, {
        skippedIds: skipped,
    });
    const showCard = mode !== 'list';
    const showList = mode !== 'card';
    const openCount = steps.length - completedCount;
    const allOpenSkipped = openCount > 0 && now == null && skippedOpenCount > 0;

    if (steps.length === 0) {
        if (!showCard) return null;
        return (
            <div className="flex h-full flex-col rounded-xl border-2 border-[#ff9d00]/70 bg-[#ff9d00]/10 px-3 py-3 shadow-[0_0_24px_rgba(255,157,0,0.16)] sm:px-4 sm:py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff9d00]">Do this now</p>
                <p className="mt-2 text-base font-bold text-white sm:text-lg">No habits for today</p>
            </div>
        );
    }

    return (
        <div className={showList ? 'space-y-3' : 'h-full'}>
            {showCard ? (
                <div className="flex h-full flex-col rounded-xl border-2 border-[#ff9d00]/70 bg-[#ff9d00]/10 px-3 py-3 shadow-[0_0_24px_rgba(255,157,0,0.16)] sm:px-4 sm:py-4">
                    {now ? (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff9d00]">
                                Do this now · {timeOfDayLabel(now.time_of_day)}
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                                <span className="text-3xl leading-none" aria-hidden>
                                    {now.icon || '•'}
                                </span>
                                <p className="min-w-0 flex-1 text-base font-bold text-white sm:text-xl">{now.name}</p>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => onToggle(now.id)}
                                    className="inline-flex items-center justify-center rounded-full bg-[#ff9d00] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(255,157,0,0.35)] transition hover:bg-[#ffb020]"
                                >
                                    Mark done
                                </button>
                                {onSkip ? (
                                    <button
                                        type="button"
                                        onClick={() => onSkip(now.id)}
                                        className="inline-flex items-center justify-center rounded-full border border-[#ff9d00]/55 bg-black/30 px-4 py-2 text-sm font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/15"
                                    >
                                        Skip
                                    </button>
                                ) : null}
                            </div>
                        </>
                    ) : allOpenSkipped ? (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff9d00]">
                                Skipped for now
                            </p>
                            <p className="mt-2 text-base font-bold text-white sm:text-lg">
                                {skippedOpenCount} habit{skippedOpenCount === 1 ? '' : 's'} still open were skipped.
                            </p>
                            {onClearSkips ? (
                                <button
                                    type="button"
                                    onClick={onClearSkips}
                                    className="mt-4 inline-flex items-center justify-center self-start rounded-full border border-[#ff9d00]/55 bg-black/30 px-4 py-2 text-sm font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/15"
                                >
                                    Bring skipped back
                                </button>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff9d00]">
                                Habits complete
                            </p>
                            <p className="mt-2 text-base font-bold text-white sm:text-lg">The routine for this day is done.</p>
                        </>
                    )}
                    <p className="mt-auto pt-3 text-xs text-slate-400">
                        {completedCount} of {steps.length} habits done
                        {skippedOpenCount > 0 ? ` · ${skippedOpenCount} skipped` : ''}
                    </p>
                </div>
            ) : null}

            {showList ? (
                <ol className="space-y-1.5">
                    {steps.map((step, index) => {
                        const previous = index > 0 ? steps[index - 1] : null;
                        const showHeading = !previous || previous.time_of_day !== step.time_of_day;
                        const categories = step.categories?.length ? step.categories : [step.category];
                        const doneTime = step.done ? completedLabel(step.checked_at) : null;
                        const isNow = now?.id === step.id;
                        const isSkipped = !step.done && skipped.has(step.id);

                        return (
                            <li key={step.id}>
                                {showHeading ? (
                                    <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9d00]/80 first:mt-0">
                                        {timeOfDayLabel(step.time_of_day)}
                                    </p>
                                ) : null}
                                <label
                                    className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 ${
                                        isNow
                                            ? 'border-[#ff9d00]/70 bg-[#ff9d00]/10'
                                            : isSkipped
                                              ? 'border-dashed border-[#ff9d00]/35 bg-black/20'
                                              : 'border-transparent hover:bg-white/5'
                                    }`}
                                >
                                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
                                        {step.step}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={step.done}
                                        onChange={() => onToggle(step.id)}
                                        className="h-5 w-5 shrink-0 rounded border-[#ff9d00]/50 text-[#ff9d00] focus:ring-[#ff9d00]/40"
                                        aria-label={`${step.done ? 'Undo' : 'Complete'} ${step.name}`}
                                    />
                                    <span className="shrink-0 text-lg" aria-hidden>
                                        {step.icon || '•'}
                                    </span>
                                    <span
                                        className={`min-w-0 flex-1 break-words ${
                                            step.done ? 'text-slate-500 line-through' : isSkipped ? 'text-slate-400' : 'text-white'
                                        }`}
                                    >
                                        {doneTime ? `(${doneTime}) ${step.name}` : step.name}
                                    </span>
                                    {isNow ? (
                                        <span className="shrink-0 rounded-full bg-[#ff9d00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                                            Now
                                        </span>
                                    ) : null}
                                    {isSkipped ? (
                                        <span className="shrink-0 rounded-full border border-[#ff9d00]/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ffe066]">
                                            Skipped
                                        </span>
                                    ) : null}
                                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                                        {categories.map((cat) => (
                                            <span
                                                key={cat}
                                                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${CATEGORY_COLORS[cat]}`}
                                                title={cat}
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
        </div>
    );
}
