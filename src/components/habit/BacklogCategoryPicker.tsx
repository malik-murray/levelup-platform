'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BacklogCategory } from '@/lib/habit/backlogCategories';

type BacklogCategoryPickerProps = {
    categories: BacklogCategory[];
    selectedIds: string[];
    onChange: (categoryIds: string[]) => void;
    compact?: boolean;
    disabled?: boolean;
};

export function formatCategoryPickerLabel(
    categories: BacklogCategory[],
    selectedIds: string[]
): string {
    if (selectedIds.length === 0) return 'Tags';
    const names = selectedIds
        .map((id) => categories.find((category) => category.id === id)?.name)
        .filter(Boolean) as string[];
    if (names.length === 0) return 'Tags';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]} +${names.length - 1}`;
}

export function BacklogCategoryPicker({
    categories,
    selectedIds,
    onChange,
    compact = false,
    disabled = false,
}: BacklogCategoryPickerProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const label = useMemo(
        () => formatCategoryPickerLabel(categories, selectedIds),
        [categories, selectedIds]
    );

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const toggleCategory = (categoryId: string) => {
        if (disabled) return;
        if (selectedIds.includes(categoryId)) {
            onChange(selectedIds.filter((id) => id !== categoryId));
            return;
        }
        onChange([...selectedIds, categoryId]);
    };

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className={`flex items-center gap-1 rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 text-left text-white transition hover:border-[#ff9d00]/60 disabled:opacity-50 ${
                    compact ? 'max-w-[7rem] px-1.5 py-0.5 text-[10px]' : 'max-w-[9rem] px-2 py-1 text-[11px]'
                }`}
            >
                <span className="truncate">{label}</span>
                <svg
                    className={`h-3 w-3 shrink-0 text-[#ff9d00] transition ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open ? (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-44 min-w-[9rem] overflow-y-auto rounded-md border border-[#ff9d00]/35 bg-[#03060f] py-1 shadow-lg"
                >
                    {categories.length === 0 ? (
                        <p className="px-2 py-1.5 text-[10px] text-slate-400">No tags yet</p>
                    ) : (
                        categories.map((category) => {
                            const checked = selectedIds.includes(category.id);
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    role="option"
                                    aria-selected={checked}
                                    onClick={() => toggleCategory(category.id)}
                                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] transition hover:bg-[#ff9d00]/10 ${
                                        checked ? 'text-[#ffe066]' : 'text-slate-200'
                                    }`}
                                >
                                    <span
                                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                            checked
                                                ? 'border-[#ff9d00]/70 bg-[#ff9d00]/25 text-[#ffe066]'
                                                : 'border-[#ff9d00]/30 bg-black/40'
                                        }`}
                                        aria-hidden
                                    >
                                        {checked ? '✓' : ''}
                                    </span>
                                    <span className="truncate">{category.name}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}
