export default function ReflectionPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Reflection → Lesson</h1>
                <p className="text-xs text-slate-400">
                    Turn raw thoughts and journal entries into clear lessons and actions.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>This app will eventually:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>Take in your daily reflections (typed or pasted)</li>
                    <li>Extract the core lesson and principle</li>
                    <li>Generate 1–3 concrete action steps</li>
                    <li>Save those lessons into a searchable LevelUp library</li>
                </ul>
            </section>
        </main>
    );
}
