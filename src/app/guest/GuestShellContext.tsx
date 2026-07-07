'use client';

import { createContext, useContext, useState } from 'react';
import { PreviewProvider } from '@/lib/previewStore';
import GuestBanner from '@/components/access/GuestBanner';
import GuestSidebar from './components/GuestSidebar';

type GuestShellContextValue = { openSidebar: () => void };
const GuestShellContext = createContext<GuestShellContextValue | null>(null);

export function useGuestSidebar() {
    const ctx = useContext(GuestShellContext);
    return ctx?.openSidebar ?? (() => {});
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const value = { openSidebar: () => setSidebarOpen(true) };

    return (
        <PreviewProvider isPreview>
            <GuestShellContext.Provider value={value}>
                <div className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-[#010205] text-white">
                    <GuestBanner />
                    <div className="flex min-w-0 flex-1">
                        <GuestSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
                    </div>
                </div>
            </GuestShellContext.Provider>
        </PreviewProvider>
    );
}
