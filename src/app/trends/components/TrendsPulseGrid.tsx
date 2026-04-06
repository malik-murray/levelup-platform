'use client';

import { trendsPulse } from '@/lib/trends/trendsCopy';

type Pulse = {
    levelingUp: number;
    losingXp: number;
    streakPower: number;
    inactive10: number;
};

type Props = {
    pulse: Pulse;
};

export default function TrendsPulseGrid({ pulse }: Props) {
    const cells = [
        {
            label: trendsPulse.levelingUpLabel,
            value: pulse.levelingUp,
            aria: trendsPulse.levelingUpAria(pulse.levelingUp),
            border: 'border-emerald-500/35',
            bg: 'bg-emerald-950/20',
            text: 'text-emerald-300',
        },
        {
            label: trendsPulse.losingXpLabel,
            value: pulse.losingXp,
            aria: trendsPulse.losingXpAria(pulse.losingXp),
            border: 'border-rose-500/35',
            bg: 'bg-rose-950/20',
            text: 'text-rose-300',
        },
        {
            label: trendsPulse.streakPowerLabel,
            value: pulse.streakPower,
            aria: trendsPulse.streakPowerAria(pulse.streakPower),
            border: 'border-amber-500/35',
            bg: 'bg-amber-950/20',
            text: 'text-amber-300',
        },
        {
            label: trendsPulse.inactiveLabel,
            value: pulse.inactive10,
            aria: trendsPulse.inactiveAria(pulse.inactive10),
            border: 'border-violet-500/35',
            bg: 'bg-violet-950/20',
            text: 'text-violet-300',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cells.map((c) => (
                <div
                    key={c.label}
                    className={`rounded-xl border ${c.border} ${c.bg} p-3`}
                    aria-label={c.aria}
                >
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${c.text}`}>{c.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums text-white">{c.value}</p>
                </div>
            ))}
        </div>
    );
}
