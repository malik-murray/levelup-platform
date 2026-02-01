'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type App = {
    name: string;
    href: string;
    icon: string;
};

const apps: App[] = [
    { name: 'Dashboard (Daily Entry)', href: '/dashboard', icon: '📊' },
    { name: 'Habit Tracker', href: '/habit', icon: '📈' },
    { name: 'Finance Tracker', href: '/finance', icon: '💰' },
    { name: 'Newsfeed', href: '/newsfeed', icon: '📰' },
    { name: 'Fitness Tracker', href: '/fitness', icon: '💪' },
    { name: 'Stock & Crypto Analyzer', href: '/markets', icon: '📊' },
];

export default function AppSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-64 bg-slate-950 border-r border-slate-800
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">Apps</h2>
                        <button
                            onClick={onClose}
                            className="lg:hidden p-1 rounded-md hover:bg-slate-800"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* App List */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        <ul className="space-y-2">
                            {apps.map((app) => {
                                const isActive = pathname === app.href;
                                return (
                                    <li key={app.href}>
                                        <Link
                                            href={app.href}
                                            onClick={onClose}
                                            className={`
                                                flex items-center gap-3 px-4 py-3 rounded-lg
                                                transition-colors
                                                ${
                                                    isActive
                                                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                }
                                            `}
                                        >
                                            <span className="text-xl">{app.icon}</span>
                                            <span className="font-medium">{app.name}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>
            </aside>
        </>
    );
}
