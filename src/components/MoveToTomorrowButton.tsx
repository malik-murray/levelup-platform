'use client';

type MoveToTomorrowButtonProps = {
  itemLabel: string;
  onClick: () => void;
  /** @deprecated prefer `size` */
  compact?: boolean;
  size?: 'default' | 'compact' | 'xs' | 'xxs';
};

function resolveSize(compact: boolean, size?: MoveToTomorrowButtonProps['size']): NonNullable<MoveToTomorrowButtonProps['size']> {
  if (size) return size;
  return compact ? 'compact' : 'default';
}

function sizeStyles(size: NonNullable<MoveToTomorrowButtonProps['size']>) {
  if (size === 'xxs') {
    return { box: 'h-[18px] w-[18px] min-h-0 min-w-0 rounded', icon: 'h-2.5 w-2.5' };
  }
  if (size === 'xs') {
    return { box: 'min-h-[22px] min-w-[22px] rounded', icon: 'h-3 w-3' };
  }
  if (size === 'compact') {
    return { box: 'min-h-[28px] min-w-[28px] rounded-md', icon: 'h-3.5 w-3.5' };
  }
  return { box: 'min-h-[40px] min-w-[40px] rounded-xl', icon: 'h-5 w-5' };
}

function CalendarForwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14h6m0 0l-2-2m2 2l-2 2" />
    </svg>
  );
}

export function MoveToTomorrowButton({
  itemLabel,
  onClick,
  compact = false,
  size,
}: MoveToTomorrowButtonProps) {
  const resolvedSize = resolveSize(compact, size);
  const { box: sizeClass, icon: iconClass } = sizeStyles(resolvedSize);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center border border-[#ff9d00]/40 bg-[#ff9d00]/5 text-[#ff9d00]/80 transition hover:border-[#ff9d00]/65 hover:bg-[#ff9d00]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9d00]/40 ${sizeClass}`}
      aria-label={`Move ${itemLabel} to tomorrow`}
      title="Move to tomorrow"
    >
      <CalendarForwardIcon className={iconClass} />
    </button>
  );
}
