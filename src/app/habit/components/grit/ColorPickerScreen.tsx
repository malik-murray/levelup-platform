'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

const PRESET_COLORS = [
  '#f4b73f', '#e11d48', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  '#ec4899', '#ef4444', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1', '#a855f7', '#64748b',
];

export function ColorPickerScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  const [draft, setDraft] = useState<import('../../lib/gritTypes').GritHabitFormDraft | null>(null);
  const [customColor, setCustomColor] = useState('#f4b73f');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    const d = getStoredDraft();
    setDraft(d || null);
    if (d?.color) setCustomColor(d.color);
  }, []);

  const selectColor = (color: string) => {
    if (!draft) return;
    setStoredDraft({ ...draft, color });
    router.push(returnTo);
  };

  const applyCustom = () => {
    selectColor(customColor);
  };

  if (!draft) {
    return <HabitFlowLoading />;
  }

  return (
    <HabitFlowShell title="Color" onBack={() => router.push(returnTo)}>
      <p className="mb-4 text-sm text-slate-400">Choose a color for your habit.</p>

      <div className="mb-8 grid grid-cols-4 gap-3">
        {PRESET_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => selectColor(hex)}
            className="min-h-[56px] aspect-square rounded-2xl border-2 border-white/20 shadow-lg transition hover:border-[#ff9d00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
            style={{ backgroundColor: hex }}
            aria-label={`Color ${hex}`}
          />
        ))}
      </div>

      <div className={`${neon.panel} overflow-hidden`}>
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="flex min-h-[56px] w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-[#ff9d00]/5"
        >
          <span className="text-slate-300">Custom color</span>
          <span className="text-[#ff9d00]/60">{showCustom ? '▼' : '›'}</span>
        </button>
        {showCustom ? (
          <div className="flex flex-wrap items-center gap-4 border-t border-[#ff9d00]/15 p-4">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-14 w-14 cursor-pointer rounded-xl border border-[#ff9d00]/30"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-12 min-w-[120px] flex-1 rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-3 text-white"
              placeholder="#hex"
            />
            <button
              type="button"
              onClick={applyCustom}
              className="min-h-[48px] rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00] px-5 py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(255,157,0,0.25)]"
            >
              Use this color
            </button>
          </div>
        ) : null}
      </div>
    </HabitFlowShell>
  );
}
