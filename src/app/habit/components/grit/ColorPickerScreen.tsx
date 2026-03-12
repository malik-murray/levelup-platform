'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';

const PRESET_COLORS = [
  '#f4b73f', '#e11d48', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  '#ec4899', '#ef4444', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1', '#a855f7', '#64748b',
];

export function ColorPickerScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

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
    return (
      <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col">
      <header className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Color</h1>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-white/60 mb-4">Choose a color for your habit.</p>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {PRESET_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => selectColor(hex)}
              className="aspect-square rounded-2xl shadow-lg border-2 border-white/20 hover:border-white/40 focus:ring-2 focus:ring-[var(--lu-accent)] min-h-[56px]"
              style={{ backgroundColor: hex }}
              aria-label={`Color ${hex}`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            className="w-full flex items-center justify-between py-4 px-4 min-h-[56px] text-left"
          >
            <span className="text-white/80">Custom color</span>
            <span className="text-white/40">{showCustom ? '▼' : '›'}</span>
          </button>
          {showCustom && (
            <div className="p-4 border-t border-white/10 flex flex-wrap items-center gap-4">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-14 h-14 rounded-xl cursor-pointer border border-white/20"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 min-w-[120px] h-12 rounded-xl bg-white/5 border border-white/10 px-3 text-[var(--lu-text)]"
                placeholder="#hex"
              />
              <button
                type="button"
                onClick={applyCustom}
                className="py-3 px-5 rounded-xl bg-[var(--lu-accent)] text-black font-semibold min-h-[48px]"
              >
                Use this color
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
