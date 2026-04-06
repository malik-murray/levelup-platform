'use client';

import type { PlayerHudStats } from '@/lib/trends/playerStatus';
import { hudRangeCaption, trendsHud } from '@/lib/trends/trendsCopy';
import type { RangeOption } from '@/lib/trends/trendsPageTypes';

type Props = {
    hud: PlayerHudStats;
    rangeDays: RangeOption;
};

export default function PlayerStatusBar({ hud, rangeDays }: Props) {
    return (
        <div
            className="rounded-2xl border border-[#ff9d00]/45 bg-gradient-to-br from-black/50 to-[#0a1020]/90 p-4 shadow-[0_0_28px_rgba(255,157,0,0.12)] sm:p-5"
            aria-label={trendsHud.sectionAriaLabel}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff9d00]/90">
                        {trendsHud.eyebrow}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{hudRangeCaption(rangeDays)}</p>
                </div>
                {!hud.hasEnoughData && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                        <p className="font-semibold text-amber-200">{trendsHud.notEnoughDataTitle}</p>
                        <p className="mt-0.5 text-amber-100/70">{trendsHud.notEnoughDataBody}</p>
                    </div>
                )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{trendsHud.rankLabel}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#ffe066]">
                        {hud.rankDisplay}
                        <span className="ml-1 text-xs font-semibold text-slate-500">{trendsHud.avgSuffix}</span>
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{trendsHud.streakPower}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums text-cyan-300">
                        {hud.streakPowerDays}
                        <span className="ml-1 text-xs font-medium text-slate-500">{trendsHud.daysUnit}</span>
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{trendsHud.momentum}</p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-slate-200">{hud.momentumLabel}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{trendsHud.bossLane}</p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-slate-200">{hud.bossLaneLabel}</p>
                </div>
            </div>

            <p className="mt-4 text-sm text-slate-300">{hud.oneLiner}</p>
        </div>
    );
}
