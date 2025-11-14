export default function MarketsPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">Stock &amp; Crypto Analyzer</h1>
                <p className="text-xs text-slate-400">
                    Keep an eye on your watchlist and positions across stocks and crypto.
                </p>
            </header>
            <section className="px-6 py-6 text-xs text-slate-300">
                <p>Future features for this app:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>Manual portfolio + watchlist input</li>
                    <li>Daily performance summary and alerts</li>
                    <li>Simple risk / allocation breakdowns</li>
                    <li>Links to research and notes on each ticker/coin</li>
                </ul>
            </section>
        </main>
    );
}
