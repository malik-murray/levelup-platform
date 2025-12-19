'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { href: '/resume', label: 'Generate Resume & CL', icon: '📝' },
  { href: '/resume/archive', label: 'Archive', icon: '📁' },
  { href: '/resume/settings', label: 'Settings', icon: '⚙️' },
  { href: '/resume/other-apps', label: 'Other Apps', icon: '🔗' },
  { href: '/resume/content', label: 'Job Tips & Content', icon: '📚' },
  { href: 'https://lus1.com', label: 'Company Site', icon: '🌐', external: true },
];

export default function ResumeNav() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/resume" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative h-8 w-8">
              <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-amber-400">Resume & Cover Letter Generator</h1>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                AI-Powered ATS-Optimized Resumes
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <Link
              href="/dashboard"
              className="hidden sm:block rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-slate-950 border-r border-slate-800 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const content = (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-amber-300'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            );

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSidebarOpen(false)}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop Sidebar - Always visible on large screens */}
      <aside className="hidden lg:block fixed top-16 left-0 bottom-0 w-64 bg-slate-950 border-r border-slate-800 z-30">
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const content = (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-amber-300'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            );

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

