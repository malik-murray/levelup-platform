'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

function IconHome({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconLayers({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconActivity({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconApple({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 8c-2.5-2-6-1.5-7.5 1.5-2 4 .5 10 3.5 10 1.5 0 2-.7 4-.7s2.5.7 4 .7c2.7 0 5.7-5 4-9-1.3-3-4.5-3.5-6-2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8c0-2 1-3.5 2.5-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconDotsGrid({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="5" r="2" />
            <circle cx="12" cy="5" r="2" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="12" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
        </svg>
    );
}

type NavItem = {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
    {
        href: '/fitness',
        label: 'Home',
        Icon: IconHome,
        isActive: (p) => p === '/fitness' || p === '/preview/fitness',
    },
    {
        href: '/fitness/plans',
        label: 'Plans',
        Icon: IconLayers,
        isActive: (p) => p.startsWith('/fitness/plans'),
    },
    {
        href: '/fitness/progress',
        label: 'Progress',
        Icon: IconActivity,
        isActive: (p) => p.startsWith('/fitness/progress') || p.startsWith('/fitness/sessions'),
    },
    {
        href: '/fitness/nutrition',
        label: 'Nutrition',
        Icon: IconApple,
        isActive: (p) =>
            p.startsWith('/fitness/nutrition') ||
            p.startsWith('/fitness/meals') ||
            p.startsWith('/fitness/metrics') ||
            p.startsWith('/fitness/calories') ||
            p.startsWith('/fitness/macros'),
    },
    {
        href: '/fitness/more',
        label: 'More',
        Icon: IconDotsGrid,
        isActive: () => false, // fallback tab; computed below
    },
];

export default function FitnessBottomNav() {
    const pathname = usePathname() ?? '';
    const matched = NAV_ITEMS.slice(0, -1).find((item) => item.isActive(pathname));
    const activeHref = matched?.href ?? (pathname.startsWith('/fitness') ? '/fitness/more' : '');

    return (
        <nav
            className="border-t border-zinc-800 bg-black/95 px-2 pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-black/85 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
            aria-label="Fitness navigation"
        >
            <div className="mx-auto flex max-w-lg items-end justify-between gap-1">
                {NAV_ITEMS.map(({ href, label, Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`flex flex-1 flex-col items-center gap-1 py-1 ${
                            href === activeHref ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <Icon className="h-6 w-6" />
                        <span className="text-[10px] font-medium">{label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}
