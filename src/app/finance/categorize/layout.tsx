import type { ReactNode } from 'react';

/** Minimal chrome for notification deep-link categorization. */
export default function CategorizeLayout({ children }: { children: ReactNode }) {
    return (
        <main
            className="min-h-dvh min-w-0 text-slate-100"
            style={{ backgroundColor: '#0a0e14' }}
        >
            {children}
        </main>
    );
}
