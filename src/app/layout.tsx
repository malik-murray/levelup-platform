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
        <body className="antialiased bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
        <ThemeProvider>
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
