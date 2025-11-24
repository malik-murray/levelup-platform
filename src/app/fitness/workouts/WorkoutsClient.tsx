'use client';

import { useEffect, useState } from 'react';
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

type WorkoutsClientProps = {
    initialShowForm?: boolean;
};

export default function WorkoutsClient({ initialShowForm = false }: WorkoutsClientProps) {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(initialShowForm);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('strength');
    const [muscleGroup, setMuscleGroup] = useState('');
    const [duration, setDuration] = useState('');
    const [intensity, setIntensity] = useState('5');
    const [caloriesBurned, setCaloriesBurned] = useState('');
    const [notes, setNotes] = useState('');

    const workoutTypes = ['strength', 'cardio', 'mobility', 'sport', 'other'];

    useEffect(() => {
        loadWorkouts();
    }, []);

    const loadWorkouts = async () => {
        setLoading(true);
        setNotification(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('fitness_workouts')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setWorkouts((data as Workout[]) || []);
        } catch (error) {
            console.error('Error loading workouts:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load workouts');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotification(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('fitness_workouts')
                .insert({
                    date,
                    type,
                    muscle_group: muscleGroup || null,
                    duration_minutes: parseInt(duration),
                    intensity: intensity ? parseInt(intensity) : null,
                    calories_burned: caloriesBurned ? parseInt(caloriesBurned) : null,
                    notes: notes || null,
                });

            if (error) throw error;

            setNotification('Workout added successfully!');
            setShowForm(false);
            setDate(new Date().toISOString().split('T')[0]);
            setType('strength');
            setMuscleGroup('');
            setDuration('');
            setIntensity('5');
            setCaloriesBurned('');
            setNotes('');
            await loadWorkouts();
        } catch (error) {
            console.error('Error adding workout:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to add workout');
        }
    };

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
                    <h2 className="text-2xl font-bold text-white dark:text-white">Workouts</h2>
                    <p className="text-xs text-slate-400 mt-1">Track your training sessions</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    {showForm ? 'Cancel' : '+ Add Workout'}
                </button>
            </div>

            {/* Add Workout Form */}
            {showForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Log Workout</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Type</label>
                                <select
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                    required
                                >
                                    {workoutTypes.map(wt => (
                                        <option key={wt} value={wt}>{wt.charAt(0).toUpperCase() + wt.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Muscle Group (optional)</label>
                                <input
                                    type="text"
                                    value={muscleGroup}
                                    onChange={e => setMuscleGroup(e.target.value)}
                                    placeholder="e.g., Chest, Legs, Full Body"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Duration (minutes)</label>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    min="1"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Intensity (1-10, optional)</label>
                                <input
                                    type="number"
                                    value={intensity}
                                    onChange={e => setIntensity(e.target.value)}
                                    min="1"
                                    max="10"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Calories Burned (optional)</label>
                                <input
                                    type="number"
                                    value={caloriesBurned}
                                    onChange={e => setCaloriesBurned(e.target.value)}
                                    min="0"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add any notes about your workout..."
                                className="w-full h-24 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 resize-none"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                        >
                            Save Workout
                        </button>
                    </form>
                </div>
            )}

            {/* Workouts List */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Workout History</h3>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : workouts.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">
                        No workouts logged yet. Add your first workout!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {workouts.map(workout => (
                            <div key={workout.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-white capitalize">
                                                {workout.type}
                                            </span>
                                            {workout.muscle_group && (
                                                <span className="text-xs text-slate-400">- {workout.muscle_group}</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {new Date(workout.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })} • {workout.duration_minutes} min
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
        </section>
    );
}

