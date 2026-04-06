'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';
import { useTheme } from '@/components/ThemeProvider';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import {
  getSoundEffectsEnabled,
  playUiSound,
  setSoundEffectsEnabled,
} from '@/lib/soundEffects';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

const LS_PUSH = 'lu_settings_push_notifications';

function displayNameFromUser(user: { user_metadata?: Record<string, unknown> }): string | null {
  const m = user.user_metadata;
  if (!m) return null;
  for (const key of ['full_name', 'name', 'given_name', 'preferred_username'] as const) {
    const v = m[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-amber-700/90 dark:text-[#ff9d00]/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function NeonToggle({
  checked,
  onChange,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        checked
          ? 'border-[#ff9d00]/85 bg-[#ff9d00]/40 shadow-[0_0_16px_rgba(255,157,0,0.45)] dark:shadow-[0_0_16px_rgba(255,157,0,0.5)]'
          : 'border-amber-400/70 bg-slate-200/95 dark:border-[#ff9d00]/30 dark:bg-black/55'
      }`}
    >
      <span
        className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#ffea8a] to-[#ff7a00] shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function rowShell(className = '') {
  return `flex min-h-[52px] items-center gap-3 rounded-xl border border-amber-400/45 bg-white/90 px-3 py-2.5 shadow-sm transition hover:border-amber-500/60 hover:bg-white dark:border-[#ff9d00]/40 dark:bg-[#060a14]/80 dark:shadow-[inset_0_0_20px_rgba(255,157,0,0.04)] dark:hover:border-[#ff9d00]/55 dark:hover:bg-[#0a1020]/90 ${className}`;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-left text-base font-semibold tracking-wide text-amber-900 dark:text-[#ffe066] dark:[text-shadow:0_0_12px_rgba(255,224,102,0.25)]">
        {title}
      </h2>
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-white/75 shadow-md backdrop-blur-md dark:border-[#ff9d00]/55 dark:bg-black/40 dark:shadow-[0_0_32px_rgba(255,157,0,0.18),inset_0_0_40px_rgba(255,157,0,0.06)] dark:backdrop-blur-md">
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 h-px w-[min(12rem,70%)] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90 shadow-[0_0_12px_rgba(245,158,11,0.5)] dark:via-[#ffea8a] dark:opacity-95 dark:shadow-[0_0_18px_rgba(255,157,0,0.75)]"
          aria-hidden
        />
        <div className="relative space-y-2 p-3 sm:p-4">{children}</div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          window.location.href = '/login';
          return;
        }
        setEmail(user.email ?? null);
        setDisplayName(displayNameFromUser(user));
        const av = user.user_metadata?.avatar_url;
        setAvatarUrl(typeof av === 'string' && av ? av : null);
        if (typeof window !== 'undefined') {
          setSoundOn(getSoundEffectsEnabled());
          const p = localStorage.getItem(LS_PUSH);
          if (p !== null) setPushOn(p === '1');
        }
      } catch {
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      localStorage.setItem(LS_PUSH, pushOn ? '1' : '0');
    }
  }, [pushOn, loading]);

  const initials = (displayName || email || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';

  const sendPasswordReset = async () => {
    setPasswordMessage(null);
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    if (error) setPasswordMessage(error.message);
    else setPasswordMessage('Check your email for a link to reset your password.');
  };

  const openEdit = () => {
    setEditName(displayName ?? '');
    setEditOpen(true);
  };

  const saveDisplayName = async () => {
    setEditSaving(true);
    const name = editName.trim();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name || undefined },
    });
    setEditSaving(false);
    if (!error) {
      setDisplayName(name || null);
      setEditOpen(false);
    }
  };

  if (loading) {
    return (
      <main
        className={`${outfit.className} flex min-h-dvh items-center justify-center bg-slate-100 text-slate-800 dark:bg-[#010205] dark:text-white`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`${outfit.className} flex min-h-dvh min-w-0 overflow-x-hidden bg-slate-100 text-slate-900 antialiased dark:bg-[#010205] dark:text-white`}
    >
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-50/95 via-slate-100 to-slate-200/95 dark:hidden"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden>
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
            <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 lg:max-w-xl">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/55 bg-white/90 text-amber-800 shadow-md transition hover:border-amber-600 hover:bg-white dark:border-[#ff9d00]/60 dark:bg-black/50 dark:text-[#ffe066] dark:shadow-[0_0_18px_rgba(255,157,0,0.25)] dark:hover:border-[#ff9d00] dark:hover:bg-black/70"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>
              <div className="flex flex-1 justify-center">
                <div className="relative h-16 w-36 sm:h-[4.5rem] sm:w-44">
                  <Image src={LOGO_SRC} alt="Level Up Solutions" fill unoptimized className="object-contain object-center" sizes="176px" priority />
                </div>
              </div>
              <div className="h-11 w-11 shrink-0" aria-hidden />
            </div>
          </header>

          <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-12 pt-2 sm:px-6 lg:max-w-xl">
            <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-amber-900 sm:text-4xl dark:text-[#ffe066] dark:[text-shadow:0_0_24px_rgba(255,157,0,0.35)]">
              Settings
            </h1>

            <SettingsSection title="Account">
              <div className={rowShell()}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-amber-500/55 shadow-md dark:border-[#ff9d00]/50 dark:shadow-[0_0_12px_rgba(255,157,0,0.25)]">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" fill className="object-cover" unoptimized sizes="56px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200/80 text-sm font-bold text-amber-900 dark:from-[#2a1808] dark:to-[#0a0a12] dark:text-[#ffe066]">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{displayName || 'Your account'}</p>
                    <p className="truncate text-sm text-amber-900/80 dark:text-[#c9a227]/90">{email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/50 bg-amber-50/90 text-amber-900 shadow-sm transition hover:border-amber-600 hover:bg-amber-100 dark:border-[#ff9d00]/50 dark:bg-black/40 dark:text-[#ffe066] dark:shadow-[0_0_10px_rgba(255,157,0,0.2)] dark:hover:border-[#ff9d00] dark:hover:bg-[#ff9d00]/10"
                  aria-label="Edit profile"
                >
                  <IconPencil />
                </button>
              </div>

              <button type="button" className={`${rowShell()} w-full text-left`} onClick={sendPasswordReset}>
                <span className="flex-1 text-slate-600 dark:text-[#e8dcc4]/90">Change password</span>
                <IconChevron />
              </button>
              {passwordMessage ? (
                <p className="px-1 text-center text-sm text-amber-800 dark:text-[#ffe066]/90">{passwordMessage}</p>
              ) : null}
            </SettingsSection>

            <SettingsSection title="Preferences">
              <div className={rowShell()}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 text-amber-800 dark:border-[#ff9d00]/35 dark:text-[#ff9d00]"
                  aria-hidden
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-slate-800 dark:text-white">Theme</span>
                <span className="text-sm text-amber-900/90 dark:text-[#c9a227]/95">{themeLabel}</span>
                <NeonToggle
                  checked={theme === 'dark'}
                  onChange={(useDark) => setTheme(useDark ? 'dark' : 'light')}
                  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                />
              </div>

              <div className={rowShell()}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 text-amber-800 dark:border-[#ff9d00]/35 dark:text-[#ff9d00]"
                  aria-hidden
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-slate-800 dark:text-white">Sound effects</span>
                <span className="text-sm text-amber-900/90 dark:text-[#c9a227]/95">{soundOn ? 'On' : 'Off'}</span>
                <NeonToggle
                  checked={soundOn}
                  onChange={(on) => {
                    setSoundEffectsEnabled(on);
                    setSoundOn(on);
                    if (on) playUiSound('toggleOn');
                  }}
                  aria-label={soundOn ? 'Turn sound effects off' : 'Turn sound effects on'}
                />
              </div>

              <div className={rowShell()}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 text-[10px] font-bold tracking-wide text-amber-800 dark:border-[#ff9d00]/35 dark:text-[#ff9d00]">
                  EN
                </span>
                <span className="flex-1 text-slate-800 dark:text-white">Language</span>
                <span className="text-sm text-amber-900/90 dark:text-[#c9a227]/95">English</span>
                <IconChevron />
              </div>
            </SettingsSection>

            <SettingsSection title="Notifications">
              <div className={rowShell()}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 text-amber-800 dark:border-[#ff9d00]/35 dark:text-[#ff9d00]"
                  aria-hidden
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-slate-800 dark:text-white">Push notifications</span>
                <NeonToggle checked={pushOn} onChange={setPushOn} aria-label="Push notifications" />
              </div>

              <Link href="/landing" className={`${rowShell()} block w-full no-underline`}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 text-amber-800 dark:border-[#ff9d00]/35 dark:text-[#ff9d00]"
                  aria-hidden
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-slate-800 dark:text-white">Privacy policy</span>
                <IconChevron />
              </Link>
            </SettingsSection>
          </main>
        </div>
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 dark:bg-black/60 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="edit-profile-title"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-amber-400/55 bg-white p-5 shadow-xl dark:border-[#ff9d00]/50 dark:bg-[#060a14] dark:shadow-[0_0_40px_rgba(255,157,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-profile-title" className="mb-4 text-lg font-semibold text-amber-900 dark:text-[#ffe066]">
              Edit display name
            </h2>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
              className="mb-4 w-full rounded-xl border border-amber-400/50 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30 dark:border-[#ff9d00]/40 dark:bg-black/50 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#ff9d00] dark:focus:ring-[#ff9d00]/30"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 rounded-xl border border-amber-400/45 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#ff9d00]/35 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={saveDisplayName}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#ff7a00] to-[#ff9d00] py-3 text-sm font-semibold text-black shadow-[0_0_16px_rgba(255,157,0,0.35)] disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
