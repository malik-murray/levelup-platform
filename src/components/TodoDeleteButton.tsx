'use client';

type TodoDeleteButtonProps = {
  itemLabel: string;
  confirmMessage: string;
  onConfirm: () => void;
  /** @deprecated prefer `size` */
  compact?: boolean;
  size?: 'default' | 'compact' | 'xs' | 'xxs';
};

function resolveSize(compact: boolean, size?: TodoDeleteButtonProps['size']): NonNullable<TodoDeleteButtonProps['size']> {
  if (size) return size;
  return compact ? 'compact' : 'default';
}

function sizeStyles(size: NonNullable<TodoDeleteButtonProps['size']>) {
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function TodoDeleteButton({
  itemLabel,
  confirmMessage,
  onConfirm,
  compact = false,
  size,
}: TodoDeleteButtonProps) {
  const handleClick = () => {
    const confirmed = window.confirm(confirmMessage);
    if (confirmed) onConfirm();
  };

  const resolvedSize = resolveSize(compact, size);
  const { box: sizeClass, icon: iconClass } = sizeStyles(resolvedSize);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex shrink-0 items-center justify-center border border-red-400/40 bg-red-500/5 text-red-300 transition hover:border-red-400/65 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 ${sizeClass}`}
      aria-label={`Delete ${itemLabel}`}
    >
      <TrashIcon className={iconClass} />
    </button>
  );
}
