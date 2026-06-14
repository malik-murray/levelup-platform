'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

const SUGGESTED_QUESTIONS = [
    'How much do I spend on groceries per month?',
    'What did I spend on restaurants last month?',
    'What are my top spending categories?',
    'How much income did I receive this year?',
];

function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function FinanceChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content:
                'Ask me about your spending, income, or habits. I can match grocery stores like Giant even when transactions are uncategorized.',
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = { id: createId(), role: 'user', content: trimmed };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setError(null);
        setLoading(true);

        try {
            const history = nextMessages
                .filter(message => message.id !== 'welcome')
                .map(message => ({ role: message.role, content: message.content }));

            const response = await fetch('/api/finance/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history: history.slice(0, -1),
                }),
            });

            const data = (await response.json()) as { reply?: string; error?: string };
            if (!response.ok) {
                throw new Error(data.error || 'Failed to get an answer');
            }

            setMessages(prev => [
                ...prev,
                {
                    id: createId(),
                    role: 'assistant',
                    content: data.reply || 'I could not find an answer in your data.',
                },
            ]);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Something went wrong';
            setError(message);
            setMessages(prev => [
                ...prev,
                {
                    id: createId(),
                    role: 'assistant',
                    content: `Sorry, I hit an error: ${message}`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        void sendMessage(input);
    };

    return (
        <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-semibold text-violet-100">Ask about your money</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Natural-language answers from your transactions — categories, merchants, and
                    monthly averages.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 pb-4">
                {SUGGESTED_QUESTIONS.map(question => (
                    <button
                        key={question}
                        type="button"
                        disabled={loading}
                        onClick={() => void sendMessage(question)}
                        className="rounded-full border border-violet-500/30 bg-violet-950/20 px-3 py-1.5 text-left text-xs text-violet-100 transition-colors hover:bg-violet-900/30 disabled:opacity-50"
                    >
                        {question}
                    </button>
                ))}
            </div>

            <div
                className="flex-1 space-y-4 overflow-y-auto rounded-2xl border p-4 sm:p-5"
                style={{ borderColor: '#1e293b', backgroundColor: '#0f1419' }}
            >
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                message.role === 'user'
                                    ? 'bg-violet-600/30 text-violet-50'
                                    : 'border border-slate-700/80 bg-slate-900/70 text-slate-200'
                            }`}
                        >
                            {message.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
                            Looking at your transactions…
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {error && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                    {error}
                </p>
            )}

            <form onSubmit={onSubmit} className="mt-4 flex gap-2">
                <input
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    placeholder="e.g. How much do I spend at grocery stores each month?"
                    disabled={loading}
                    className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-60"
                    style={{ borderColor: '#1e293b', backgroundColor: '#0a0e14' }}
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                    Ask
                </button>
            </form>
        </div>
    );
}
