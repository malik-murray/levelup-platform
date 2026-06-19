'use client';

import type { EisenhowerFields } from '@/lib/habit/eisenhower';
import { getQuadrant, quadrantBadgeClasses, QUADRANT_META } from '@/lib/habit/eisenhower';

type EisenhowerTogglesProps = {
    value: EisenhowerFields;
    onChange: (next: EisenhowerFields) => void;
    compact?: boolean;
    disabled?: boolean;
};

export function EisenhowerToggles({ value, onChange, compact = false, disabled = false }: EisenhowerTogglesProps) {
    const quadrant = getQuadrant(value);
    const meta = QUADRANT_META[quadrant];

    const toggleImportant = () => {
        if (disabled) return;
        onChange({
            ...value,
            is_important: value.is_important === true ? false : true,
        });
    };

    const toggleUrgent = () => {
        if (disabled) return;
        onChange({
            ...value,
            is_urgent: value.is_urgent === true ? false : true,
        });
    };

    const chipBase =
        'rounded border px-1.5 py-0.5 font-semibold uppercase tracking-wide transition disabled:opacity-50';
    const chipSize = compact ? 'text-[9px]' : 'text-[10px]';
    const activeImportant = 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200';
    const idleImportant = 'border-[#ff9d00]/30 bg-black/30 text-slate-400 hover:bg-[#ff9d00]/10';
    const activeUrgent = 'border-red-400/60 bg-red-500/20 text-red-200';
    const idleUrgent = 'border-[#ff9d00]/30 bg-black/30 text-slate-400 hover:bg-[#ff9d00]/10';

    return (
        <div className={`flex shrink-0 flex-wrap items-center gap-1 ${compact ? '' : 'gap-1.5'}`}>
            <button
                type="button"
                onClick={toggleImportant}
                disabled={disabled}
                aria-pressed={value.is_important === true}
                title="Important — moves toward Q1 or Q2"
                className={`${chipBase} ${chipSize} ${value.is_important === true ? activeImportant : idleImportant}`}
            >
                Imp
            </button>
            <button
                type="button"
                onClick={toggleUrgent}
                disabled={disabled}
                aria-pressed={value.is_urgent === true}
                title="Urgent — moves toward Q1 or Q3"
                className={`${chipBase} ${chipSize} ${value.is_urgent === true ? activeUrgent : idleUrgent}`}
            >
                Urg
            </button>
            {!compact ? (
                <span
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${quadrantBadgeClasses(quadrant)}`}
                    title={meta.description}
                >
                    {meta.shortLabel}
                </span>
            ) : null}
        </div>
    );
}

export function QuadrantBadge({ value }: { value: EisenhowerFields }) {
    const quadrant = getQuadrant(value);
    const meta = QUADRANT_META[quadrant];
    return (
        <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${quadrantBadgeClasses(quadrant)}`}
            title={`${meta.label}: ${meta.description}`}
        >
            {meta.shortLabel}
        </span>
    );
}
