'use client';

import type { ReactNode } from 'react';
import { neon } from '../neonTheme';
import CollapsiblePanel from './CollapsiblePanel';

type Props = {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
    /** Optional content beside the chevron (e.g. "Updated 2m ago") */
    trailing?: ReactNode;
    /** Heading level / size: main sidebar sections use lg; nested use default */
    headingSize?: 'lg' | 'md';
};

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            className={`h-5 w-5 shrink-0 text-[#ff9d00] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

export default function DashboardCollapsibleSection({
    title,
    open,
    onToggle,
    children,
    trailing,
    headingSize = 'lg',
}: Props) {
    const headingClass =
        headingSize === 'lg'
            ? 'text-2xl font-bold text-[#ffe066]'
            : 'text-xl font-bold text-[#ffe066]';

    return (
        <div className={`${neon.widget} min-w-0 overflow-hidden p-0`}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#ff9d00]/5"
            >
                <h2
                    className={headingClass}
                    style={headingSize === 'lg' ? { textShadow: '0 0 14px rgba(255,200,80,0.25)' } : undefined}
                >
                    {title}
                </h2>
                <span className="flex shrink-0 items-center gap-2">
                    {trailing}
                    <Chevron open={open} />
                </span>
            </button>
            <CollapsiblePanel open={open} className="border-t border-[#ff9d00]/25">
                {children}
            </CollapsiblePanel>
        </div>
    );
}
