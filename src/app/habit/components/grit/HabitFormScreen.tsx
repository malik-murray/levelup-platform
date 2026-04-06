'use client';

import Link from 'next/link';
import type { GritHabitFormDraft } from '../../lib/gritTypes';
import { HabitFlowShell } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

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
    <HabitFlowShell
      title={isEdit ? 'Edit Habit' : 'New Habit'}
      onBack={onCancel}
      headerRight={
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="min-h-[44px] rounded-xl border-2 border-[#ff9d00]/60 bg-[#ff9d00]/15 px-4 py-2 text-sm font-semibold text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.15)] transition hover:bg-[#ff9d00]/25 disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
          ) : (
            'Save'
          )}
        </button>
      }
    >
      <div className="mb-8 flex justify-center px-1">
        <div
          className={`${neon.panel} flex max-w-full min-w-0 items-center gap-3 rounded-2xl px-5 py-3`}
          style={
            draft.color
              ? { borderColor: `${draft.color}99`, boxShadow: `0 0 24px ${draft.color}33` }
              : undefined
          }
        >
          <span className="shrink-0 text-2xl">{draft.icon || '📝'}</span>
          <div className="min-w-0 text-left">
            <p className="break-words font-semibold text-white [overflow-wrap:anywhere]">
              {draft.name || 'Habit name'}
            </p>
            <p className="text-xs text-[#ff9d00]/75">{frequencyLabel}</p>
          </div>
        </div>
      </div>

      <SectionRow
        label="Color"
        value={draft.color ? 'Selected' : 'Default'}
        href={`/habit/color?return=${encodeURIComponent(returnPath)}`}
      />

      <SectionRow
        label="Icon"
        value={draft.icon || '📝'}
        href={`/habit/icon?return=${encodeURIComponent(returnPath)}`}
      />

      <SectionRow
        label="Description"
        value={draft.description || 'Add description'}
        inlineEditor
        onInlineChange={(v) => setDraft({ ...draft, description: v || null })}
        inlineValue={draft.description ?? ''}
      />

      <div className="h-6" />

      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ff9d00]/85">General</p>
      <div className={`${neon.panel} overflow-hidden`}>
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

      <button
        type="button"
        onClick={onCancel}
        className="mt-8 w-full min-h-[48px] rounded-xl border-2 border-dashed border-[#ff9d00]/35 py-3 text-sm font-semibold text-slate-300 transition hover:border-[#ff9d00]/60 hover:text-[#ffe066]"
      >
        Cancel
      </button>
    </HabitFlowShell>
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
  inlineEditor?: boolean;
  onInlineChange?: (v: string) => void;
  inlineValue?: string;
}) {
  const content = (
    <div className="flex min-h-[56px] items-center justify-between px-4 py-4">
      <span className="text-slate-400">{label}</span>
      {inlineEditor && onInlineChange ? (
        <input
          type="text"
          value={inlineValue}
          onChange={(e) => onInlineChange(e.target.value)}
          placeholder="Add description"
          className="ml-4 flex-1 bg-transparent text-right text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
        />
      ) : (
        <span className="text-white">{value}</span>
      )}
      {!inlineEditor && href ? <span className="ml-2 text-[#ff9d00]/50">›</span> : null}
    </div>
  );

  if (href && !inlineEditor) {
    return (
      <Link
        href={href}
        className={`${neon.section} mb-3 block transition-colors hover:border-[#ff9d00]/55 hover:bg-[#ff9d00]/5`}
      >
        {content}
      </Link>
    );
  }
  return <div className={`${neon.section} mb-3`}>{content}</div>;
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
  const borderClass = last ? '' : 'border-b border-[#ff9d00]/15';
  const inner = (
    <div className={`flex min-h-[56px] items-center justify-between px-4 py-4 ${borderClass}`}>
      <span className="text-slate-400">{label}</span>
      <span className="flex items-center text-white">
        {value}
        {comingSoon ? <span className="ml-1 text-xs text-slate-500">(Coming soon)</span> : null}
        {!comingSoon && href ? <span className="ml-2 text-[#ff9d00]/50">›</span> : null}
      </span>
    </div>
  );

  if (comingSoon || !href) {
    return <div className="block">{inner}</div>;
  }
  return (
    <Link href={href} className="block transition-colors hover:bg-[#ff9d00]/5">
      {inner}
    </Link>
  );
}
