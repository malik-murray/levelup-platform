import type { GoalCategory } from './types';

export const GOAL_CATEGORY_META: Record<
  GoalCategory,
  { label: string; icon: string; color: string }
> = {
  financial: { label: 'Financial', icon: '💰', color: 'emerald' },
  physical: { label: 'Physical', icon: '💪', color: 'orange' },
  spiritual: { label: 'Spiritual', icon: '🙏', color: 'violet' },
  business: { label: 'Business', icon: '💼', color: 'blue' },
  personal: { label: 'Personal', icon: '✨', color: 'pink' },
  mental: { label: 'Mental', icon: '🧠', color: 'cyan' },
  health: { label: 'Health', icon: '❤️', color: 'red' },
  career: { label: 'Career', icon: '🎯', color: 'amber' },
  relationships: { label: 'Relationships', icon: '🤝', color: 'rose' },
  education: { label: 'Education', icon: '📚', color: 'indigo' },
  other: { label: 'Other', icon: '📌', color: 'slate' },
};

export function goalCategoryLabel(category: GoalCategory | null | undefined): string {
  if (!category) return 'Uncategorized';
  return GOAL_CATEGORY_META[category]?.label ?? category;
}

export function goalCategoryBadgeClass(category: GoalCategory | null | undefined): string {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium';
  switch (category) {
    case 'financial':
      return `${base} bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`;
    case 'physical':
      return `${base} bg-orange-500/15 text-orange-300 border border-orange-500/30`;
    case 'spiritual':
      return `${base} bg-violet-500/15 text-violet-300 border border-violet-500/30`;
    case 'business':
      return `${base} bg-blue-500/15 text-blue-300 border border-blue-500/30`;
    case 'personal':
      return `${base} bg-pink-500/15 text-pink-300 border border-pink-500/30`;
    case 'mental':
      return `${base} bg-cyan-500/15 text-cyan-300 border border-cyan-500/30`;
    case 'health':
      return `${base} bg-red-500/15 text-red-300 border border-red-500/30`;
    case 'career':
      return `${base} bg-amber-500/15 text-amber-300 border border-amber-500/30`;
    case 'relationships':
      return `${base} bg-rose-500/15 text-rose-300 border border-rose-500/30`;
    case 'education':
      return `${base} bg-indigo-500/15 text-indigo-300 border border-indigo-500/30`;
    default:
      return `${base} bg-slate-500/15 text-slate-300 border border-slate-500/30`;
  }
}
