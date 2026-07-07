'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { getExercisesByCategory } from '@/lib/fitness/exercises';
import type { ExerciseWithRelations } from '@/lib/fitness/types';
import {
    createQuickLogSession,
    listCompletedSessionsForUser,
    type WorkoutSession,
} from '@/lib/fitness/workoutSessions';

type Category = 'strength' | 'cardio' | 'stretch';

const CATEGORY_TABS: { value: Category; label: string }[] = [
    { value: 'strength', label: 'Strength' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'stretch', label: 'Stretch' },
];

function formatDate(value: string): string {
    const d = new Date(value);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function QuickLogClient() {
    const [category, setCategory] = useState<Category>('strength');
    const [userId, setUserId] = useState<string | null>(null);

    const [strengthExercises, setStrengthExercises] = useState<ExerciseWithRelations[]>([]);
    const [cardioExercises, setCardioExercises] = useState<ExerciseWithRelations[]>([]);
    const [stretchExercises, setStretchExercises] = useState<ExerciseWithRelations[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(true);

    const [strengthSlug, setStrengthSlug] = useState('');
    const [strengthSearch, setStrengthSearch] = useState('');
    const [sets, setSets] = useState<{ reps: string; weight_kg: string; rpe: string }[]>([
        { reps: '', weight_kg: '', rpe: '' },
    ]);

    const [cardioSlug, setCardioSlug] = useState('');
    const [cardioMinutes, setCardioMinutes] = useState('');

    const [stretchSlug, setStretchSlug] = useState('');
    const [holdSeconds, setHoldSeconds] = useState('30');
    const [rounds, setRounds] = useState('2');

    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
    const [recentLoading, setRecentLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            if (cancelled) return;
            setUserId(user.id);

            setCatalogLoading(true);
            try {
                const [strength, cardio, stretch] = await Promise.all([
                    getExercisesByCategory('strength', supabase),
                    getExercisesByCategory('cardio', supabase),
                    getExercisesByCategory('stretch', supabase),
                ]);
                if (cancelled) return;
                setStrengthExercises(strength);
                setCardioExercises(cardio);
                setStretchExercises(stretch);
                if (cardio.length > 0) setCardioSlug(cardio[0].slug);
                if (stretch.length > 0) setStretchSlug(stretch[0].slug);
            } finally {
                if (!cancelled) setCatalogLoading(false);
            }

            setRecentLoading(true);
            try {
                const completed = await listCompletedSessionsForUser(user.id, supabase, 20);
                if (!cancelled) {
                    setRecentSessions(completed.filter((s) => s.plan_id === null).slice(0, 5));
                }
            } finally {
                if (!cancelled) setRecentLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredStrengthExercises = useMemo(() => {
        const term = strengthSearch.trim().toLowerCase();
        if (!term) return strengthExercises;
        return strengthExercises.filter((ex) => ex.name.toLowerCase().includes(term));
    }, [strengthExercises, strengthSearch]);

    const resetForm = () => {
        setSets([{ reps: '', weight_kg: '', rpe: '' }]);
        setCardioMinutes('');
        setHoldSeconds('30');
        setRounds('2');
        setNotes('');
    };

    const handleSubmit = async () => {
        if (!userId) return;
        setError(null);

        try {
            setSaving(true);
            let session: { id: string };
            if (category === 'strength') {
                if (!strengthSlug) throw new Error('Choose an exercise.');
                session = await createQuickLogSession(
                    userId,
                    {
                        category: 'strength',
                        exerciseSlug: strengthSlug,
                        sets: sets.map((s) => ({
                            reps: s.reps.trim() === '' ? null : Number(s.reps),
                            weight_kg: s.weight_kg.trim() === '' ? null : Number(s.weight_kg),
                            rpe: s.rpe.trim() === '' ? null : Number(s.rpe),
                        })),
                        notes: notes.trim() || null,
                    },
                    supabase
                );
            } else if (category === 'cardio') {
                if (!cardioSlug) throw new Error('Choose a cardio type.');
                const minutesNum = Number(cardioMinutes);
                if (!Number.isFinite(minutesNum) || minutesNum <= 0) {
                    throw new Error('Enter a valid duration in minutes.');
                }
                session = await createQuickLogSession(
                    userId,
                    {
                        category: 'cardio',
                        cardioType: cardioSlug,
                        durationMinutes: minutesNum,
                        notes: notes.trim() || null,
                    },
                    supabase
                );
            } else {
                if (!stretchSlug) throw new Error('Choose a stretch or pose.');
                const holdNum = Number(holdSeconds);
                const roundsNum = Number(rounds);
                if (!Number.isFinite(holdNum) || holdNum <= 0) {
                    throw new Error('Enter a valid hold duration in seconds.');
                }
                if (!Number.isFinite(roundsNum) || roundsNum <= 0) {
                    throw new Error('Enter a valid number of rounds.');
                }
                session = await createQuickLogSession(
                    userId,
                    {
                        category: 'stretch',
                        exerciseSlug: stretchSlug,
                        holdSeconds: holdNum,
                        rounds: roundsNum,
                        notes: notes.trim() || null,
                    },
                    supabase
                );
            }
            resetForm();
            window.location.href = `/fitness/sessions/${session.id}`;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save quick log');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-6 px-6 py-4">
            <div>
                <h2 className="text-2xl font-bold text-white">Quick Log</h2>
                <p className="text-xs text-slate-400 mt-1">
                    Log a workout on the spot — it counts toward your streak and progress just like a planned session.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400">
                    {error}
                </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 space-y-4">
                <div className="flex gap-2">
                    {CATEGORY_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setCategory(tab.value)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                                category === tab.value
                                    ? 'bg-amber-400 text-black'
                                    : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {catalogLoading ? (
                    <p className="text-xs text-slate-400">Loading exercise catalog…</p>
                ) : category === 'strength' ? (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Search exercise</label>
                            <input
                                type="text"
                                value={strengthSearch}
                                onChange={(e) => setStrengthSearch(e.target.value)}
                                placeholder="e.g. bench press"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Exercise</label>
                            <select
                                value={strengthSlug}
                                onChange={(e) => setStrengthSlug(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            >
                                <option value="">Select an exercise…</option>
                                {filteredStrengthExercises.map((ex) => (
                                    <option key={ex.slug} value={ex.slug}>
                                        {ex.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs text-slate-300">Sets</label>
                            {sets.map((s, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        placeholder="Reps"
                                        value={s.reps}
                                        onChange={(e) =>
                                            setSets((prev) =>
                                                prev.map((row, i) => (i === idx ? { ...row, reps: e.target.value } : row))
                                            )
                                        }
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Weight (kg)"
                                        value={s.weight_kg}
                                        onChange={(e) =>
                                            setSets((prev) =>
                                                prev.map((row, i) =>
                                                    i === idx ? { ...row, weight_kg: e.target.value } : row
                                                )
                                            )
                                        }
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                                    />
                                    <input
                                        type="number"
                                        placeholder="RPE"
                                        value={s.rpe}
                                        onChange={(e) =>
                                            setSets((prev) =>
                                                prev.map((row, i) => (i === idx ? { ...row, rpe: e.target.value } : row))
                                            )
                                        }
                                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setSets((prev) => [...prev, { reps: '', weight_kg: '', rpe: '' }])}
                                className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                            >
                                + Add set
                            </button>
                        </div>
                    </div>
                ) : category === 'cardio' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Cardio type</label>
                            <select
                                value={cardioSlug}
                                onChange={(e) => setCardioSlug(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            >
                                {cardioExercises.map((ex) => (
                                    <option key={ex.slug} value={ex.slug}>
                                        {ex.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Duration (minutes)</label>
                            <input
                                type="number"
                                min={1}
                                value={cardioMinutes}
                                onChange={(e) => setCardioMinutes(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-3">
                            <label className="block text-xs text-slate-300 mb-1">Stretch / pose</label>
                            <select
                                value={stretchSlug}
                                onChange={(e) => setStretchSlug(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            >
                                {stretchExercises.map((ex) => (
                                    <option key={ex.slug} value={ex.slug}>
                                        {ex.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Hold (seconds)</label>
                            <input
                                type="number"
                                min={1}
                                value={holdSeconds}
                                onChange={(e) => setHoldSeconds(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Rounds</label>
                            <input
                                type="number"
                                min={1}
                                value={rounds}
                                onChange={(e) => setRounds(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs text-slate-300 mb-1">Notes (optional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="How did it feel?"
                        className="w-full h-20 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 resize-none"
                    />
                </div>

                <button
                    type="button"
                    disabled={saving || catalogLoading}
                    onClick={() => void handleSubmit()}
                    className="w-full rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-60"
                >
                    {saving ? 'Saving…' : 'Save quick log'}
                </button>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Recently logged</h3>
                {recentLoading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : recentSessions.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">No quick logs yet.</div>
                ) : (
                    <div className="space-y-2">
                        {recentSessions.map((session) => (
                            <Link
                                key={session.id}
                                href={`/fitness/sessions/${session.id}`}
                                className="block rounded-md border border-slate-800 bg-slate-900 p-3 hover:border-amber-500/50"
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-white">{session.name}</span>
                                    <span className="text-slate-400">{formatDate(session.started_at)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
