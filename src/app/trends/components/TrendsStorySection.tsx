'use client';

import type { ReactNode } from 'react';

type Props = {
    step: string;
    title: string;
    subtitle: string;
    children: ReactNode;
};

export default function TrendsStorySection({ step, title, subtitle, children }: Props) {
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                    {step}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">·</span>
                <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
            </div>
            <p className="max-w-3xl text-sm text-slate-400">{subtitle}</p>
            {children}
        </section>
    );
}
