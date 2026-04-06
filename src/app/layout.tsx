import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthHashErrorHandler } from "@/components/AuthHashErrorHandler";

export const metadata: Metadata = {
    title: "LevelUpSolutions",
    description: "LevelUpSolutions app ecosystem",
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
            <AuthHashErrorHandler />
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
