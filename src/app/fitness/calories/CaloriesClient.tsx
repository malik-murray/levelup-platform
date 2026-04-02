'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';

type Sex = 'male' | 'female';
type ActivityLevel =
    | 'sedentary'
    | 'lightly_active'
    | 'moderately_active'
    | 'very_active'
    | 'extra_active';
type Goal = 'maintain' | 'cut' | 'bulk';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
};

const GOAL_ADJUSTMENT: Record<Goal, number> = {
    maintain: 0,
    cut: -300,
    bulk: 300,
};

export default function CaloriesClient() {
    const [loading, setLoading] = useState(true);
    const [age, setAge] = useState('30');
    const [sex, setSex] = useState<Sex>('male');
    const [heightCm, setHeightCm] = useState('175');
    const [weightKg, setWeightKg] = useState('75');
    const [activityLevel, setActivityLevel] =
        useState<ActivityLevel>('moderately_active');
    const [goal, setGoal] = useState<Goal>('maintain');

    useEffect(() => {
        let cancelled = false;
        async function checkAuth() {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();
            if (cancelled) return;
            if (error || !user) {
                window.location.href = '/login';
                return;
            }
            setLoading(false);
        }
        checkAuth();
        return () => {
            cancelled = true;
        };
    }, []);

    const result = useMemo(() => {
        const parsedAge = Number(age);
        const parsedHeight = Number(heightCm);
        const parsedWeight = Number(weightKg);

        if (
            Number.isNaN(parsedAge) ||
            Number.isNaN(parsedHeight) ||
            Number.isNaN(parsedWeight) ||
            parsedAge <= 0 ||
            parsedHeight <= 0 ||
            parsedWeight <= 0
        ) {
            return null;
        }

        // Mifflin-St Jeor BMR estimate.
        const bmr =
            sex === 'male'
                ? 10 * parsedWeight + 6.25 * parsedHeight - 5 * parsedAge + 5
                : 10 * parsedWeight + 6.25 * parsedHeight - 5 * parsedAge - 161;

        const maintenance = bmr * ACTIVITY_MULTIPLIER[activityLevel];
        const target = maintenance + GOAL_ADJUSTMENT[goal];

        return {
            bmr: Math.round(bmr),
            maintenance: Math.round(maintenance),
            target: Math.max(1200, Math.round(target)),
        };
    }, [age, sex, heightCm, weightKg, activityLevel, goal]);

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
                    Calorie Calculator
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Estimate your maintenance calories and a simple daily target.
                </p>
            </header>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Age</span>
                        <input
                            type="number"
                            min={10}
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Sex</span>
                        <select
                            value={sex}
                            onChange={(e) => setSex(e.target.value as Sex)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                            Height (cm)
                        </span>
                        <input
                            type="number"
                            min={100}
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                            Weight (kg)
                        </span>
                        <input
                            type="number"
                            min={30}
                            step="0.1"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-300">
                            Activity level
                        </span>
                        <select
                            value={activityLevel}
                            onChange={(e) =>
                                setActivityLevel(e.target.value as ActivityLevel)
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="sedentary">
                                Sedentary (little to no exercise)
                            </option>
                            <option value="lightly_active">
                                Lightly active (1-3 days/week)
                            </option>
                            <option value="moderately_active">
                                Moderately active (3-5 days/week)
                            </option>
                            <option value="very_active">
                                Very active (6-7 days/week)
                            </option>
                            <option value="extra_active">
                                Extra active (hard training + active job)
                            </option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-300">Goal</span>
                        <select
                            value={goal}
                            onChange={(e) => setGoal(e.target.value as Goal)}
                            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="maintain">Maintain</option>
                            <option value="cut">Cut (moderate deficit)</option>
                            <option value="bulk">Bulk (moderate surplus)</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Estimated calories
                </h2>
                {!result ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Enter valid values to see your estimate.
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        <p className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">BMR:</span> {result.bmr} kcal/day
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">Maintenance:</span>{' '}
                            {result.maintenance} kcal/day
                        </p>
                        <p className="text-slate-900 dark:text-white">
                            <span className="font-semibold">Target:</span> {result.target}{' '}
                            kcal/day
                        </p>
                        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                            This is an estimate based on Mifflin-St Jeor and your selected
                            activity level. Adjust based on your real-world progress. Not medical
                            advice.
                        </p>
                        <p className="pt-2">
                            <Link
                                href={`/fitness/macros?calories=${result.target}`}
                                className="text-sm font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                            >
                                Use {result.target} cal in Macro Calculator →
                            </Link>
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
