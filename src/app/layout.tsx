import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthHashErrorHandler } from "@/components/AuthHashErrorHandler";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { PlaidSyncPoller } from "@/components/PlaidSyncPoller";
import { PlaidWebhookBootstrap } from "@/components/PlaidWebhookBootstrap";

const navBtnClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70";

export const metadata: Metadata = {
    title: "LevelUpSolutions",
    description: "LevelUpSolutions app ecosystem",
    manifest: "/manifest.json",
    icons: {
        icon: [{ url: "/brand/levelup-app-icon-192.png", sizes: "192x192", type: "image/png" }],
        apple: [{ url: "/brand/levelup-app-icon-512.png", sizes: "512x512", type: "image/png" }],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "LevelUp",
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="min-w-0 max-w-full overflow-x-clip" suppressHydrationWarning>
        <body className="min-w-0 max-w-full overflow-x-clip antialiased bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
        <ThemeProvider>
            <ServiceWorkerUpdater />
            <PlaidSyncPoller />
            <PlaidWebhookBootstrap />
            <AuthHashErrorHandler />
            <div className="fixed right-4 top-8 z-50 flex items-center gap-2">
                <ThemeToggle className={`${navBtnClass} rounded-xl p-0`} />
                <Link
                    href="/dashboard"
                    className={navBtnClass}
                    aria-label="Dashboard"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 12l9-8 9 8M5 10v10h14V10M9 20v-6h6v6"
                        />
                    </svg>
                </Link>
            </div>
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
