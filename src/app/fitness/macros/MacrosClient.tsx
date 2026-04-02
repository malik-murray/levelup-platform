'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';

type Goal = 'maintain' | 'cut' | 'bulk';
type Preset = 'balanced' | 'high_protein' | 'lower_carb';

const PRESET_SPLITS: Record<Preset, { protein: number; carbs: number; fats: number }> = {
    balanced: { protein: 0.3, carbs: 0.4, fats: 0.3 },
    high_protein: { protein: 0.35, carbs: 0.35, fats: 0.3 },
    lower_carb: { protein: 0.35, carbs: 0.25, fats: 0.4 },
};

export default function MacrosClient() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [calorieTarget, setCalorieTarget] = useState('2400');
    const [goal, setGoal] = useState<Goal>('maintain');
    const [preset, setPreset] = useState<Preset>('balanced');

    useEffect(() => {
        let cancelled = false;
        async function checkAuthAndPrefill() {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();
            if (cancelled) return;
            if (error || !user) {
                window.location.href = '/login';
                return;
            }
            const fromQuery = searchParams.get('calories');
            if (fromQuery && !Number.isNaN(Number(fromQuery)) && Number(fromQuery) > 0) {
                setCalorieTarget(String(Math.round(Number(fromQuery))));
            }
            setLoading(false);
        }
        checkAuthAndPrefill();
        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    const result = useMemo(() => {
        const calories = Number(calorieTarget);
        if (Number.isNaN(calories) || calories <= 0) return null;

        const split = PRESET_SPLITS[preset];
        const proteinCalories = calories * split.protein;
        const carbCalories = calories * split.carbs;
        const fatCalories = calories * split.fats;

        return {
            calories: Math.round(calories),
            proteinGrams: Math.round(proteinCalories / 4),
            carbsGrams: Math.round(carbCalories / 4),
            fatsGrams: Math.round(fatCalories / 9),
        };
    }, [calorieTarget, preset]);

    if (loading) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
    }

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Macro Calculator
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Convert your calorie target into daily protein, carbs, and fats.
                </p>
            </header>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                            Daily calorie target
                        </span>
                        <input
                            type="number"
                            min={800}
                            value={calorieTarget}
                            onChange={(e) => setCalorieTarget(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Goal</span>
                        <select
                            value={goal}
                            onChange={(e) => setGoal(e.target.value as Goal)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="maintain">Maintain</option>
                            <option value="cut">Cut</option>
                            <option value="bulk">Bulk</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-300">Macro preset</span>
                        <select
                            value={preset}
                            onChange={(e) => setPreset(e.target.value as Preset)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="balanced">Balanced (30% protein / 40% carbs / 30% fats)</option>
                            <option value="high_protein">High protein (35% / 35% / 30%)</option>
                            <option value="lower_carb">Lower carb (35% / 25% / 40%)</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Daily macro estimate
                </h2>
                {!result ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Enter a valid calorie target to calculate macros.
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        <p className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">Calorie target used:</span>{' '}
                            {result.calories} kcal/day
                        </p>
                        <p className="text-slate-900 dark:text-white">
                            <span className="font-semibold">Protein:</span> {result.proteinGrams} g/day
                        </p>
                        <p className="text-slate-900 dark:text-white">
                            <span className="font-semibold">Carbs:</span> {result.carbsGrams} g/day
                        </p>
                        <p className="text-slate-900 dark:text-white">
                            <span className="font-semibold">Fats:</span> {result.fatsGrams} g/day
                        </p>
                        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                            These are starting estimates based on your selected preset.
                        </p>
                        <p className="pt-2">
                            <Link
                                href="/fitness/calories"
                                className="text-sm font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                            >
                                ← Calorie Calculator (estimate your target)
                            </Link>
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
