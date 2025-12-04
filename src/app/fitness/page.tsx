'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';

type Workout = {
    id: string;
    date: string;
    type: string;
    muscle_group: string | null;
    duration_minutes: number;
    intensity: number | null;
    calories_burned: number | null;
    notes: string | null;
};

type Meal = {
    id: string;
    date: string;
    meal_type: string;
    description: string;
    calories: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
};

type Metric = {
    id: string;
    date: string;
    weight_kg: number | null;
    steps: number | null;
    water_ml: number | null;
    sleep_hours: number | null;
};

type Goal = {
    daily_steps_target: number;
    daily_calories_target: number;
    daily_water_ml_target: number;
    weekly_workout_minutes_target: number;
};

export default function FitnessPage() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [meals, setMeals] = useState<Meal[]>([]);
    const [metrics, setMetrics] = useState<Metric | null>(null);
    const [goals, setGoals] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    const today = useMemo(() => {
        const date = new Date();
        return date.toISOString().split('T')[0];
    }, []);

    const todayStr = useMemo(() => {
        const date = new Date();
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }, []);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        setNotification(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // Load today's workouts
            const { data: workoutsData, error: workoutsError } = await supabase
                .from('fitness_workouts')
                .select('*')
                .eq('date', today)
                .order('created_at', { ascending: false });

            if (workoutsError) throw workoutsError;

            // Load today's meals
            const { data: mealsData, error: mealsError } = await supabase
                .from('fitness_meals')
                .select('*')
                .eq('date', today)
                .order('created_at', { ascending: false });

            if (mealsError) throw mealsError;

            // Load today's metrics
            const { data: metricsData, error: metricsError } = await supabase
                .from('fitness_metrics')
                .select('*')
                .eq('date', today)
                .single();

            if (metricsError && metricsError.code !== 'PGRST116') {
                throw metricsError;
            }

            // Load goals (or create defaults)
            const { data: goalsData, error: goalsError } = await supabase
                .from('fitness_goals')
                .select('*')
                .single();

            if (goalsError && goalsError.code === 'PGRST116') {
                // Create default goals
                const { data: newGoals, error: insertError } = await supabase
                    .from('fitness_goals')
                    .insert({
                        daily_steps_target: 10000,
                        daily_calories_target: 2000,
                        daily_water_ml_target: 2500,
                        weekly_workout_minutes_target: 150,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                setGoals(newGoals as Goal);
            } else if (goalsError) {
                throw goalsError;
            } else {
                setGoals(goalsData as Goal);
            }

            setWorkouts(workoutsData as Workout[] || []);
            setMeals(mealsData as Meal[] || []);
            setMetrics(metricsData as Metric || null);

            // Load weekly summary
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekStartStr = weekStart.toISOString().split('T')[0];

            // Weekly workout minutes
            const { data: weeklyWorkouts, error: weeklyError } = await supabase
                .from('fitness_workouts')
                .select('duration_minutes')
                .gte('date', weekStartStr);

            if (!weeklyError && weeklyWorkouts) {
                // Store for display (we'll show this in summary)
                // For now, just load it but don't display yet
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const todayCalories = useMemo(() => {
        return meals.reduce((sum, meal) => sum + meal.calories, 0);
    }, [meals]);

    const todayWorkoutMinutes = useMemo(() => {
        return workouts.reduce((sum, workout) => sum + workout.duration_minutes, 0);
    }, [workouts]);

    const caloriesBurned = useMemo(() => {
        return workouts.reduce((sum, workout) => sum + (workout.calories_burned || 0), 0);
    }, [workouts]);

    const waterIntake = metrics?.water_ml || 0;
    const steps = metrics?.steps || 0;
    const weight = metrics?.weight_kg || null;

    return (
        <section className="space-y-6 px-6 py-4">
            {notification && (
                <div className={`rounded-lg border p-3 text-xs ${
                    notification.includes('Error') || notification.includes('Failed')
                        ? 'border-red-500/30 bg-red-950/20 text-red-400'
                        : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                }`}>
                    {notification}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white dark:text-white">{todayStr}</h2>
                    <p className="text-xs text-slate-400 mt-1">Today's Progress</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400 mb-1">Steps</div>
                    <div className="text-2xl font-bold text-white">
                        {steps.toLocaleString()}
                    </div>
                    {goals && (
                        <div className="text-xs text-slate-500 mt-1">
                            of {goals.daily_steps_target.toLocaleString()} goal
                        </div>
                    )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400 mb-1">Calories In</div>
                    <div className="text-2xl font-bold text-white">{todayCalories}</div>
                    {goals && (
                        <div className="text-xs text-slate-500 mt-1">
                            of {goals.daily_calories_target} goal
                        </div>
                    )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400 mb-1">Calories Out</div>
                    <div className="text-2xl font-bold text-white">{caloriesBurned}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400 mb-1">Water</div>
                    <div className="text-2xl font-bold text-white">
                        {(waterIntake / 1000).toFixed(1)}L
                    </div>
                    {goals && (
                        <div className="text-xs text-slate-500 mt-1">
                            of {(goals.daily_water_ml_target / 1000).toFixed(1)}L goal
                        </div>
                    )}
                </div>
            </div>

            {/* Today's Workouts */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Today's Workouts</h3>
                    <Link
                        href="/fitness/workouts?add=true"
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        + Add Workout
                    </Link>
                </div>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : workouts.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                        No workouts logged today. Add your first workout!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {workouts.map(workout => (
                            <div key={workout.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-white capitalize">
                                            {workout.type} {workout.muscle_group ? `- ${workout.muscle_group}` : ''}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {workout.duration_minutes} min
                                            {workout.intensity && ` • Intensity: ${workout.intensity}/10`}
                                            {workout.calories_burned && ` • ${workout.calories_burned} cal`}
                                        </div>
                                        {workout.notes && (
                                            <div className="text-xs text-slate-500 mt-1">{workout.notes}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Today's Meals */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Today's Meals</h3>
                    <Link
                        href="/fitness/meals?add=true"
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        + Add Meal
                    </Link>
                </div>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : meals.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                        No meals logged today. Add your first meal!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {meals.map(meal => (
                            <div key={meal.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-white capitalize">
                                            {meal.meal_type}: {meal.description}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {meal.calories} cal
                                            {meal.protein_g && ` • P: ${meal.protein_g}g`}
                                            {meal.carbs_g && ` • C: ${meal.carbs_g}g`}
                                            {meal.fat_g && ` • F: ${meal.fat_g}g`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Today's Metrics */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Today's Metrics</h3>
                    <Link
                        href="/fitness/metrics?date=today"
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        Log Metrics
                    </Link>
                </div>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : !metrics ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                        No metrics logged today. Log your weight, steps, water, and sleep!
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {weight && (
                            <div>
                                <div className="text-xs text-slate-400">Weight</div>
                                <div className="text-lg font-semibold text-white">{weight} kg</div>
                            </div>
                        )}
                        <div>
                            <div className="text-xs text-slate-400">Steps</div>
                            <div className="text-lg font-semibold text-white">{steps.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Water</div>
                            <div className="text-lg font-semibold text-white">{(waterIntake / 1000).toFixed(1)}L</div>
                        </div>
                        {metrics.sleep_hours && (
                            <div>
                                <div className="text-xs text-slate-400">Sleep</div>
                                <div className="text-lg font-semibold text-white">{metrics.sleep_hours}h</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Weekly Summary */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Weekly Summary</h3>
                <div className="text-xs text-slate-400">
                    Weekly summary coming soon. Track your consistency and progress over time.
                </div>
            </div>
        </section>
    );
}



