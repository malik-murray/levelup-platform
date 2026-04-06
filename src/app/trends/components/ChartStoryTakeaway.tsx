'use client';

type Props = {
    text: string;
};

export default function ChartStoryTakeaway({ text }: Props) {
    if (!text.trim()) return null;
    return (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100/95">
            {text}
        </div>
    );
}
