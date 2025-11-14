export default function EmotionsPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Emotional Tracker</h1>
                <p className="text-xs text-slate-400">
                    Log how you feel, what triggered it, and how you responded.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>This will evolve into your emotional dashboard:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>Quick mood check-ins (1–5)</li>
                    <li>Tag emotions (anxiety, peace, gratitude, etc.)</li>
                    <li>Track triggers and coping tools</li>
                    <li>Connect with your spiritual practices and reflections</li>
                </ul>
            </section>
        </main>
    );
}
