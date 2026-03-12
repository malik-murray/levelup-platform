'use client';

import { createContext, useContext, useState } from 'react';
import { PreviewProvider } from '@/lib/previewStore';
import PreviewBanner from '@/components/PreviewBanner';
import PreviewSidebar from './components/PreviewSidebar';

type PreviewShellContextValue = { openSidebar: () => void };
const PreviewShellContext = createContext<PreviewShellContextValue | null>(null);

export function usePreviewSidebar() {
  const ctx = useContext(PreviewShellContext);
  return ctx?.openSidebar ?? (() => {});
}

export default function PreviewShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const value = { openSidebar: () => setSidebarOpen(true) };
  return (
    <PreviewProvider isPreview>
      <PreviewShellContext.Provider value={value}>
        <div className="min-h-screen bg-black text-white flex flex-col">
          <PreviewBanner />
          <div className="flex flex-1">
            <PreviewSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
              {children}
            </div>
          </div>
        </div>
      </PreviewShellContext.Provider>
    </PreviewProvider>
  );
}
