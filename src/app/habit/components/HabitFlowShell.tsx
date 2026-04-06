'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

const headerBtnClass =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70';

export function HabitFlowLoading() {
  return (
    <div
      className={`${outfit.className} flex min-h-dvh items-center justify-center bg-[#010205] text-white antialiased`}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  );
}

export function HabitFlowShell({
  title,
  headerRight,
  onBack,
  children,
  mainClassName = '',
}: {
  title?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  mainClassName?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`${outfit.className} ${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden`}>
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, #050816 0%, #010205 42%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -8%, rgba(255,120,40,0.2) 0%, transparent 55%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent),
                radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.2), transparent),
                radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.28), transparent)
              `,
              backgroundSize: '100% 100%',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-40 opacity-30"
            style={{
              background:
                'linear-gradient(to top, rgba(255,100,30,0.15) 0%, transparent 70%), repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(255,157,0,0.06) 12px, rgba(255,157,0,0.06) 14px)',
              maskImage: 'linear-gradient(to top, black, transparent)',
            }}
          />
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="min-w-0 px-4 pb-2 pt-5 sm:px-6">
            <div className="mx-auto grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-2 lg:max-w-6xl">
              <div className="flex justify-start gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen((o) => !o)}
                  className={headerBtnClass}
                  aria-label="Open menu"
                >
                  <IconMenu />
                </button>
                {onBack ? (
                  <button type="button" onClick={onBack} className={headerBtnClass} aria-label="Back">
                    <IconBack />
                  </button>
                ) : null}
              </div>
              <div className="relative h-16 w-36 shrink-0 sm:h-[4.5rem] sm:w-44">
                <Image
                  src={LOGO_SRC}
                  alt="Level Up Solutions"
                  fill
                  unoptimized
                  className="object-contain object-center"
                  sizes="176px"
                  priority
                />
              </div>
              <div className="flex min-h-11 items-center justify-end">{headerRight ?? <span className="w-11" aria-hidden />}</div>
            </div>
            {title ? (
              <p
                className="mx-auto mt-3 text-center text-lg font-bold tracking-tight sm:text-xl"
                style={{ color: '#ffe066', textShadow: '0 0 18px rgba(255,200,80,0.35)' }}
              >
                {title}
              </p>
            ) : null}
          </header>

          <main className={`min-w-0 flex-1 overflow-auto px-4 py-6 pb-28 sm:px-6 ${mainClassName}`}>
            <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
