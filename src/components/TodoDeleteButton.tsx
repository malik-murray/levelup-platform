'use client';

type TodoDeleteButtonProps = {
  itemLabel: string;
  confirmMessage: string;
  onConfirm: () => void;
  compact?: boolean;
};

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
}: TodoDeleteButtonProps) {
  const handleClick = () => {
    const confirmed = window.confirm(confirmMessage);
    if (confirmed) onConfirm();
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-md border border-red-400/40 bg-red-500/5 text-red-300 transition hover:border-red-400/65 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
        aria-label={`Delete ${itemLabel}`}
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/5 text-red-300 transition hover:border-red-400/65 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
      aria-label={`Delete ${itemLabel}`}
    >
      <TrashIcon className="h-5 w-5" />
    </button>
  );
}
