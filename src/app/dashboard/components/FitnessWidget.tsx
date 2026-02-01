'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';

type Workout = {
    id: string;
    type: string;
    duration_minutes: number;
    calories_burned: number | null;
};

type Metric = {
    weight_kg: number | null;
    steps: number | null;
    water_ml: number | null;
    sleep_hours: number | null;
};

export default function FitnessWidget({
    selectedDate,
    userId,
}: {
    selectedDate: Date;
    userId: string | null;
}) {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [metrics, setMetrics] = useState<Metric | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [selectedDate, userId]);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);

            // Load today's workouts
            const { data: workoutsData } = await supabase
                .from('fitness_workouts')
                .select('id, type, duration_minutes, calories_burned')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .order('created_at', { ascending: false })
                .limit(3);

            // Load today's metrics
            const { data: metricsData } = await supabase
                .from('fitness_metrics')
                .select('weight_kg, steps, water_ml, sleep_hours')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            setWorkouts(workoutsData || []);
            setMetrics(metricsData || null);
        } catch (error) {
            console.error('Error loading fitness data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
            </div>
        );
    }

    const totalCalories = workouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0);
    const totalDuration = workouts.reduce((sum, w) => sum + w.duration_minutes, 0);

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Link href="/fitness" className="hover:underline">
                    <h3 className="text-lg font-semibold">Fitness</h3>
                </Link>
            </div>

            {/* Today's Stats */}
            <div className="space-y-2">
                {workouts.length > 0 && (
                    <div className="text-sm">
                        <div className="text-slate-400">Workouts: {workouts.length}</div>
                        <div className="text-slate-400">Duration: {totalDuration} min</div>
                        {totalCalories > 0 && (
                            <div className="text-slate-400">Calories: {totalCalories}</div>
                        )}
                    </div>
                )}

                {metrics && (
                    <div className="text-sm space-y-1">
                        {metrics.steps && (
                            <div className="text-slate-400">Steps: {metrics.steps.toLocaleString()}</div>
                        )}
                        {metrics.weight_kg && (
                            <div className="text-slate-400">Weight: {metrics.weight_kg} kg</div>
                        )}
                        {metrics.water_ml && (
                            <div className="text-slate-400">Water: {metrics.water_ml} ml</div>
                        )}
                    </div>
                )}

                {workouts.length === 0 && !metrics && (
                    <p className="text-xs text-slate-500">No data for today</p>
                )}
            </div>

            <div className="pt-2 border-t border-slate-700">
                <Link
                    href="/fitness"
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                    View full Fitness Tracker →
                </Link>
            </div>
        </div>
    );
}
