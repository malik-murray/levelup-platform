export default function HabitPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Habit Tracker</h1>
                <p className="text-xs text-slate-400">
                    Track daily habits, XP, streaks, and your LevelUp life score.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>This is the skeleton for your Habit Tracker app.</p>
                <p className="mt-2">
                    Next steps: daily habit list, morning/afternoon/evening scores, category
                    grades, and weekly summaries.
                </p>
            </section>
        </main>
    );
}
