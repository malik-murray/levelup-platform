import type { Metadata } from "next";
import "./globals.css";

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
        <html lang="en">
        <body className="antialiased bg-slate-950 text-white">
        {children}
        </body>
        </html>
    );
}
