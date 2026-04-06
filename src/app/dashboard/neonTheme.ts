/** Shared “space / neon orange” dashboard tokens (mobile mock) */
export const neon = {
  pageBg: 'min-h-screen bg-[#010205] text-white antialiased',
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
  /** Trends pages: segmented control track (matches habit / dashboard chrome) */
  trendsPillRow:
    'flex flex-wrap gap-1 rounded-full border border-[#ff9d00]/40 bg-[#060a14]/90 p-1 shadow-[inset_0_0_20px_rgba(255,157,0,0.05)] backdrop-blur-sm',
  trendsPillOn:
    'rounded-full px-3 py-1.5 text-xs font-semibold bg-[#ff9d00]/25 text-[#ffe066] shadow-[0_0_14px_rgba(255,157,0,0.14)]',
  trendsPillOff:
    'rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-[#ffe066]/90',
} as const;
