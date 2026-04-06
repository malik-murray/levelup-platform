'use client';

import { useEffect, useRef, useState } from 'react';
import { scoreTierColor } from '@/lib/trends/trendsScoreRing';

const R = 44;
const STROKE = 8;
const C = 2 * Math.PI * R;

type Props = {
    label: string;
    percent: number | null;
    sublabel: string;
    /** 0–1 for ring fill when percent is null (no data) */
    empty?: boolean;
    emptyHint?: string;
    activeSlot?: boolean;
};

export default function TrendsScoreRing({
    label,
    percent,
    sublabel,
    empty,
    emptyHint,
    activeSlot = false,
}: Props) {
    const p = percent ?? 0;
    const arc = empty || percent == null ? 0 : Math.min(100, Math.max(0, p)) / 100;
    const dash = arc * C;
    const strokeColor = empty || percent == null ? 'rgba(255,157,0,0.25)' : scoreTierColor(p);
    const trackColor = 'rgba(255,157,0,0.14)';
    const [glowActive, setGlowActive] = useState(false);
    const prevValueRef = useRef<string | null>(null);

    useEffect(() => {
        const nextValueKey = `${percent ?? 'null'}|${sublabel}|${empty ? '1' : '0'}`;
        const prevValueKey = prevValueRef.current;
        prevValueRef.current = nextValueKey;
        if (prevValueKey == null || prevValueKey === nextValueKey) return;

        setGlowActive(true);
        const timeout = window.setTimeout(() => setGlowActive(false), 800);
        return () => window.clearTimeout(timeout);
    }, [percent, sublabel, empty]);

    const ariaLabel =
        empty || percent == null
            ? `${label}: no data, ${sublabel}.${emptyHint ? ` ${emptyHint}` : ''}`
            : `${label}: ${percent.toFixed(1)} percent, ${sublabel.replace('/', ' of ')}`;

    return (
        <div className="flex max-w-[140px] flex-col items-center gap-2">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#ff9d00]/80">
                {label}
            </p>
            <div
                className={`relative h-[112px] w-[112px] rounded-full transition-shadow duration-500 ${
                    glowActive || activeSlot ? 'shadow-[0_0_22px_-2px]' : 'shadow-none'
                }`}
                style={
                    glowActive || activeSlot
                        ? { boxShadow: `0 0 22px -2px ${activeSlot ? '#ff9d00' : strokeColor}` }
                        : undefined
                }
                role="img"
                aria-label={ariaLabel}
            >
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden focusable="false">
                    <circle
                        cx="50"
                        cy="50"
                        r={R}
                        fill="none"
                        stroke={trackColor}
                        strokeWidth={STROKE}
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r={R}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${C}`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-bold leading-tight text-white tabular-nums">
                        {empty || percent == null ? '—' : `${percent.toFixed(1)}%`}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium tabular-nums text-slate-500">
                        {sublabel}
                    </span>
                </div>
            </div>
            {activeSlot && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffe066]">Active now</p>
            )}
            {empty && emptyHint ? (
                <p className="px-1 text-center text-[10px] leading-snug text-slate-500">{emptyHint}</p>
            ) : null}
        </div>
    );
}
