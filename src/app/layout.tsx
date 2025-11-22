import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
    title: "LevelUpSolutions",
    description: "LevelUpSolutions app ecosystem",
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className="antialiased bg-slate-950 text-white dark:bg-slate-950 dark:text-white light:bg-white light:text-slate-900 transition-colors">
        <ThemeProvider>
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
