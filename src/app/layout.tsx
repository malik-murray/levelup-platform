import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    title: "LevelUpSolutions Platform",
    description: "LevelUpSolutions app ecosystem",
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body className="min-h-screen bg-black text-white">
        <div className="min-h-screen flex flex-col">
            {/* Global brand header */}
            <header className="border-b border-[#f4b73f]/25 bg-black/95 backdrop-blur">
                <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Image
                            src="/logo.png"
                            alt="LevelUpSolutions logo"
                            width={32}
                            height={32}
                        />
                        <span className="text-sm font-semibold tracking-wide">
                  <span className="text-[#f4b73f]">LEVELUP</span>{" "}
                            <span className="text-white">SOLUTIONS</span>
                </span>
                    </Link>

                    {/* Space for future user menu / settings */}
                    <div className="text-[11px] text-neutral-400">
                        Your ecosystem, one login.
                    </div>
                </div>
            </header>

            {/* Page content */}
            <main className="flex-1 bg-black">{children}</main>
        </div>
        </body>
        </html>
    );
}
