/**
 * Shared "space / neon gold" design tokens for LevelUp Solutions.
 * Originally dashboard-only; now the platform-wide token set — every app
 * (Finance, Fitness, Goals, Habit, Trends, To-Do, ...) should import `neon`
 * from here rather than hardcoding its own accent/border/shadow values.
 */
export const neon = {
  pageBg: 'min-h-screen bg-white text-slate-900 antialiased transition-colors dark:bg-[#010205] dark:text-white',
  /** Full-width shell card */
  panel:
    'rounded-2xl border-2 border-[#ff9d00]/55 bg-black/40 backdrop-blur-md shadow-[0_0_32px_rgba(255,157,0,0.18),inset_0_0_40px_rgba(255,157,0,0.06)]',
  /** Nested section inside daily plan */
  section:
    'rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 backdrop-blur-sm shadow-[inset_0_0_24px_rgba(255,157,0,0.04)]',
  /** Small widgets / notes */
  widget:
    'rounded-xl border-2 border-[#ff9d00]/45 bg-black/35 backdrop-blur-sm shadow-[0_0_22px_rgba(255,157,0,0.1)]',
  glowText: 'text-[#ffe066]',
  accent: '#ff9d00',
  accentGlow: '#ffe066',

  /** Heading scale — use across every app for consistent hierarchy */
  headingLg: 'text-2xl font-bold tracking-tight text-[#ffe066] sm:text-3xl',
  headingMd: 'text-lg font-bold text-[#ffe066] sm:text-xl',
  headingSm: 'text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500',

  /** Buttons */
  buttonPrimary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-[#ff9d00] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(255,157,0,0.35)] transition hover:bg-[#ffb020] active:scale-[0.98]',
  buttonOutline:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-[#ff9d00]/40 bg-black/20 px-3 py-1.5 text-xs font-semibold text-[#ffe066] transition hover:border-[#ff9d00]/70 hover:bg-[#ff9d00]/10',
  buttonGhost:
    'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-[#ff9d00]/10 hover:text-[#ffe066]',

  /** Status/category badge */
  badge: 'inline-flex items-center gap-1 rounded-full bg-[#ff9d00]/20 px-2 py-0.5 text-xs font-medium text-[#ffe066]',

  /** Generic segmented-control / tab row (formerly "trends"-only naming, kept as aliases below) */
  pillRow:
    'flex flex-wrap gap-1 rounded-full border border-[#ff9d00]/40 bg-[#060a14]/90 p-1 shadow-[inset_0_0_20px_rgba(255,157,0,0.05)] backdrop-blur-sm',
  pillOn:
    'rounded-full px-3 py-1.5 text-xs font-semibold bg-[#ff9d00]/25 text-[#ffe066] shadow-[0_0_14px_rgba(255,157,0,0.14)]',
  pillOff:
    'rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-[#ffe066]/90',

  /** @deprecated use pillRow */
  get trendsPillRow() {
    return neon.pillRow;
  },
  /** @deprecated use pillOn */
  get trendsPillOn() {
    return neon.pillOn;
  },
  /** @deprecated use pillOff */
  get trendsPillOff() {
    return neon.pillOff;
  },
} as const;
