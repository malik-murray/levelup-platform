export default function NewsfeedPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Newsfeed Summarizer</h1>
                <p className="text-xs text-slate-400">
                    Turn the firehose of news into a simple daily brief.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>Later we&apos;ll hook this into APIs + GPT to:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>Pull headlines from your chosen sources</li>
                    <li>Summarize into 3–5 key bullets</li>
                    <li>Tag by topic (finance, world, tech, spiritual, etc.)</li>
                </ul>
            </section>
        </main>
    );
}
