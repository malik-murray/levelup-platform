'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { playUiSound } from '@/lib/soundEffects';
import { LOCKED_APP_LABELS } from '@/lib/access/entitlements';

type NavItem = {
    name: string;
    href?: string;
    icon: string;
    locked?: boolean;
    lockedApp?: keyof typeof LOCKED_APP_LABELS;
};

const primaryNav: NavItem[] = [
    { name: 'Dashboard', href: '/guest/dashboard', icon: '📊' },
    { name: 'To-Do', icon: '📝', locked: true, lockedApp: 'todo' },
    { name: 'Goals & Vision', icon: '🎯', locked: true, lockedApp: 'goals' },
    { name: 'Trends', icon: '📉', locked: true, lockedApp: 'trends' },
    { name: 'Weekly plan', icon: '📅', locked: true, lockedApp: 'habit-weekly-plan' },
];

const otherApps: NavItem[] = [
    { name: 'Habits Tracker', href: '/guest/habit', icon: '✅' },
    { name: 'Finance Tracker', icon: '💰', locked: true, lockedApp: 'finance' },
    { name: 'Newsfeed', icon: '📰', locked: true, lockedApp: 'newsfeed' },
    { name: 'Fitness Tracker', icon: '💪', locked: true, lockedApp: 'fitness' },
    { name: 'Stock & Crypto', icon: '📈', locked: true, lockedApp: 'markets' },
];

function NavRow({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
    const href = item.locked && item.lockedApp ? `/upgrade?app=${item.lockedApp}` : item.href ?? '/guest/dashboard';
    const isActive = item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;

    return (
        <li>
            <Link
                href={href}
                onClick={() => {
                    playUiSound('tap');
                    onClose();
                }}
                className={`flex items-center gap-3 rounded-xl border-2 border-transparent px-4 py-3 transition-colors ${
                    isActive
                        ? 'border-[#ff9d00]/50 bg-[#ff9d00]/15 text-[#ffe066]'
                        : item.locked
                          ? 'text-slate-500 opacity-70 hover:bg-[#ff9d00]/5 hover:text-slate-300'
                          : 'text-slate-300 hover:bg-[#ff9d00]/10 hover:text-white'
                }`}
            >
                <span className={`text-xl ${item.locked ? 'grayscale-[0.35]' : ''}`}>{item.icon}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                    <span className="truncate">{item.name}</span>
                    {item.locked ? (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            🔒
                        </span>
                    ) : null}
                </span>
            </Link>
        </li>
    );
}

export default function GuestSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {isOpen ? <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} /> : null}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-[#ff9d00]/25 bg-[#020408] transition-transform duration-300 lg:static ${
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-[#ff9d00]/20 p-4">
                        <h2 className="text-lg font-bold text-[#ffe066]">Menu</h2>
                        <button onClick={onClose} className="rounded-md p-1 hover:bg-[#ff9d00]/10 lg:hidden">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-4">
                        <ul className="space-y-2">
                            {primaryNav.map((item) => (
                                <NavRow key={item.name} item={item} pathname={pathname} onClose={onClose} />
                            ))}
                        </ul>
                        <section className="mt-6 space-y-2">
                            <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Other apps
                            </h3>
                            <ul className="space-y-2">
                                {otherApps.map((item) => (
                                    <NavRow key={item.name} item={item} pathname={pathname} onClose={onClose} />
                                ))}
                            </ul>
                        </section>
                    </nav>
                    <div className="space-y-2 border-t border-[#ff9d00]/20 p-4">
                        <Link
                            href="/login?mode=signup&redirect=/onboarding/preview"
                            onClick={onClose}
                            className="flex w-full items-center justify-center rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/15 px-4 py-3 text-sm font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/25"
                        >
                            Create account
                        </Link>
                        <Link
                            href="/login"
                            onClick={onClose}
                            className="flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:text-[#ffe066]"
                        >
                            Log in
                        </Link>
                    </div>
                </div>
            </aside>
        </>
    );
}
