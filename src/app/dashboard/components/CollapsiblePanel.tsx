'use client';

import type { ReactNode } from 'react';

type Props = {
    open: boolean;
    children: ReactNode;
    /** Extra classes on the outer grid wrapper (e.g. border-t) */
    className?: string;
};

/**
 * Animated vertical collapse using CSS grid rows. Children stay mounted so open/close
 * can transition smoothly; pair with prefers-reduced-motion (no transition).
 * Structured for future logic (time of day, completion state) to drive `open`.
 */
export default function CollapsiblePanel({ open, children, className = '' }: Props) {
    return (
        <div
            className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} ${className}`.trim()}
        >
            <div className="min-h-0 overflow-hidden" aria-hidden={!open}>
                {children}
            </div>
        </div>
    );
}
