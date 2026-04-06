'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { neon } from '@/app/dashboard/neonTheme';

const LINKS = [
    { href: '/trends', label: 'Overview' },
    { href: '/trends/breakdown', label: 'Habit breakdown' },
    { href: '/trends/streaks', label: 'Streaks' },
] as const;

export default function TrendsSubNav() {
    const pathname = usePathname();
    return (
        <nav
            className="flex flex-wrap justify-center gap-1.5 border-b border-[#ff9d00]/20 bg-black/20 px-4 py-2.5 backdrop-blur-sm sm:justify-start sm:gap-2 lg:px-6"
            aria-label="Trends sections"
        >
            {LINKS.map(({ href, label }) => {
                const active =
                    href === '/trends'
                        ? pathname === '/trends'
                        : pathname === href || pathname.startsWith(`${href}/`);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={
                            active ? neon.trendsPillOn : `${neon.trendsPillOff} border border-transparent`
                        }
                    >
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
