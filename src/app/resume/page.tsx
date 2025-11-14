export default function ResumePage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Resume Generator</h1>
                <p className="text-xs text-slate-400">
                    Generate tailored resumes and cover letters for each job you apply to.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>Skeleton only for now.</p>
                <p className="mt-2">
                    Later we’ll plug in job descriptions, your profile, and GPT prompts to
                    auto-generate resumes + cover letters.
                </p>
            </section>
        </main>
    );
}
