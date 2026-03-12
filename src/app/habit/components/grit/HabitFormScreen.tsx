'use client';

import Link from 'next/link';
import type { GritHabitFormDraft } from '../../lib/gritTypes';

interface HabitFormScreenProps {
  draft: GritHabitFormDraft;
  setDraft: (d: GritHabitFormDraft) => void;
  isEdit: boolean;
  habitId?: string;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  good: 'Good',
  bad: 'Bad',
  track: 'Track',
  todo: 'To-Do',
};

const FREQUENCY_LABELS: Record<string, string> = {
  morning: 'Daily (Morning)',
  afternoon: 'Daily (Afternoon)',
  evening: 'Daily (Evening)',
  '': 'Daily',
};

export function HabitFormScreen({
  draft,
  setDraft,
  isEdit,
  habitId,
  onSave,
  onCancel,
  saving,
}: HabitFormScreenProps) {
  const frequencyLabel = FREQUENCY_LABELS[draft.time_of_day ?? ''] ?? 'Daily';

  const returnPath = isEdit && habitId ? `/habit/${habitId}/edit` : '/habit/new';

  return (
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col safe-area-pb">
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[var(--lu-bg)]/95 backdrop-blur border-b border-white/5">
        <button
          type="button"
          onClick={onCancel}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Cancel"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">{isEdit ? 'Edit Habit' : 'New Habit'}</h1>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--lu-accent)] disabled:opacity-50 disabled:pointer-events-none"
        >
          {saving ? (
            <span className="w-5 h-5 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            'Save'
          )}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {/* Preview pill */}
        <div className="mb-8 flex justify-center">
          <div
            className="inline-flex items-center gap-3 px-5 py-3 rounded-full border border-white/10 bg-white/5 shadow-lg"
            style={draft.color ? { borderColor: draft.color, backgroundColor: `${draft.color}20` } : undefined}
          >
            <span className="text-2xl">{draft.icon || '📝'}</span>
            <div className="text-left">
              <p className="font-semibold">{draft.name || 'Habit name'}</p>
              <p className="text-xs text-white/60">{frequencyLabel}</p>
            </div>
          </div>
        </div>

        {/* Color */}
        <SectionRow
          label="Color"
          value={draft.color ? 'Selected' : 'Default'}
          href={`/habit/color?return=${encodeURIComponent(returnPath)}`}
        />

        {/* Icon */}
        <SectionRow
          label="Icon"
          value={draft.icon || '📝'}
          href={`/habit/icon?return=${encodeURIComponent(returnPath)}`}
        />

        {/* Description */}
        <SectionRow
          label="Description"
          value={draft.description || 'Add description'}
          inlineEditor
          onInlineChange={(v) => setDraft({ ...draft, description: v || null })}
          inlineValue={draft.description ?? ''}
        />

        <div className="h-4" />

        {/* General settings */}
        <p className="text-sm font-medium text-white/60 mb-2 px-1">General</p>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <SettingsRow
            label="Type"
            value={TYPE_LABELS[draft.type] || draft.type}
            href={isEdit ? `/habit/type?return=/habit/${habitId}/edit` : '/habit/type?return=/habit/new'}
          />
          <SettingsRow
            label="Groups"
            value="None"
            href={`/habit/groups?return=${encodeURIComponent(returnPath)}`}
          />
          <SettingsRow label="Goal" value={draft.goal_id ? 'Linked' : 'None'} comingSoon />
          <SettingsRow label="Average" value="—" comingSoon />
          <SettingsRow
            label="Repeat"
            value={frequencyLabel}
            href={`/habit/repeat?return=${encodeURIComponent(returnPath)}`}
          />
          <SettingsRow label="Notifications" value="Off" comingSoon />
          <SettingsRow label="URL" value="—" comingSoon />
          <SettingsRow label="Starts on" value="—" comingSoon />
          <SettingsRow label="Ends" value="—" comingSoon last />
        </div>
      </main>
    </div>
  );
}

function SectionRow({
  label,
  value,
  href,
  inlineEditor,
  onInlineChange,
  inlineValue,
}: {
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
  hrefPath?: string;
  inlineEditor?: boolean;
  onInlineChange?: (v: string) => void;
  inlineValue?: string;
}) {
  const content = (
    <div className="flex items-center justify-between py-4 px-4 min-h-[56px]">
      <span className="text-white/70">{label}</span>
      {inlineEditor && onInlineChange ? (
        <input
          type="text"
          value={inlineValue}
          onChange={(e) => onInlineChange(e.target.value)}
          placeholder="Add description"
          className="flex-1 ml-4 bg-transparent text-right text-[var(--lu-text)] placeholder:text-white/40 focus:outline-none"
        />
      ) : (
        <span className="text-[var(--lu-text)]">{value}</span>
      )}
      {!inlineEditor && href && (
        <span className="ml-2 text-white/40">›</span>
      )}
    </div>
  );

  if (href && !inlineEditor) {
    return (
      <Link href={href} className="block rounded-2xl bg-white/5 border border-white/10 mb-2">
        {content}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 mb-2">
      {content}
    </div>
  );
}

function SettingsRow({
  label,
  value,
  href,
  comingSoon,
  last,
}: {
  label: string;
  value: string;
  href?: string;
  comingSoon?: boolean;
  last?: boolean;
}) {
  const borderClass = last ? '' : 'border-b border-white/5';
  const inner = (
    <div className={`flex items-center justify-between py-4 px-4 min-h-[56px] ${borderClass}`}>
      <span className="text-white/70">{label}</span>
      <span className="text-[var(--lu-text)]">
        {value}
        {comingSoon && <span className="ml-1 text-xs text-white/40">(Coming soon)</span>}
      </span>
      {!comingSoon && href && <span className="ml-2 text-white/40">›</span>}
    </div>
  );

  if (comingSoon || !href) {
    return <div className="block">{inner}</div>;
  }
  return (
    <Link href={href} className="block active:bg-white/5">
      {inner}
    </Link>
  );
}
