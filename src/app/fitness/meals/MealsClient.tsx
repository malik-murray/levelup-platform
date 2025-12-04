'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@auth/supabaseClient';

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

type DailyTotals = {
    date: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    meals: Meal[];
};

type MealsClientProps = {
    initialShowForm?: boolean;
};

export default function MealsClient({ initialShowForm = false }: MealsClientProps) {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(initialShowForm);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mealType, setMealType] = useState('breakfast');
    const [description, setDescription] = useState('');
    const [calories, setCalories] = useState('');
    const [proteinG, setProteinG] = useState('');
    const [carbsG, setCarbsG] = useState('');
    const [fatG, setFatG] = useState('');

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

    // Group meals by date and calculate daily totals
    const dailyTotals = useMemo(() => {
        const grouped = new Map<string, DailyTotals>();

        meals.forEach(meal => {
            const existing = grouped.get(meal.date);
            if (existing) {
                existing.meals.push(meal);
                existing.calories += meal.calories;
                existing.protein_g += meal.protein_g || 0;
                existing.carbs_g += meal.carbs_g || 0;
                existing.fat_g += meal.fat_g || 0;
            } else {
                grouped.set(meal.date, {
                    date: meal.date,
                    calories: meal.calories,
                    protein_g: meal.protein_g || 0,
                    carbs_g: meal.carbs_g || 0,
                    fat_g: meal.fat_g || 0,
                    meals: [meal],
                });
            }
        });

        return Array.from(grouped.values()).sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [meals]);

    useEffect(() => {
        loadMeals();
    }, []);

    const loadMeals = async () => {
        setLoading(true);
        setNotification(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('fitness_meals')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            setMeals((data as Meal[]) || []);
        } catch (error) {
            console.error('Error loading meals:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load meals');
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
                .from('fitness_meals')
                .insert({
                    date,
                    meal_type: mealType,
                    description: description.trim(),
                    calories: parseInt(calories),
                    protein_g: proteinG ? parseFloat(proteinG) : null,
                    carbs_g: carbsG ? parseFloat(carbsG) : null,
                    fat_g: fatG ? parseFloat(fatG) : null,
                });

            if (error) throw error;

            setNotification('Meal added successfully!');
            setShowForm(false);
            setDate(new Date().toISOString().split('T')[0]);
            setMealType('breakfast');
            setDescription('');
            setCalories('');
            setProteinG('');
            setCarbsG('');
            setFatG('');
            await loadMeals();
        } catch (error) {
            console.error('Error adding meal:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to add meal');
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
                    <h2 className="text-2xl font-bold text-white dark:text-white">Meals</h2>
                    <p className="text-xs text-slate-400 mt-1">Track your nutrition</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    {showForm ? 'Cancel' : '+ Add Meal'}
                </button>
            </div>

            {/* Add Meal Form */}
            {showForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Log Meal</h3>
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
                                <label className="block text-xs text-slate-300 mb-1">Meal Type</label>
                                <select
                                    value={mealType}
                                    onChange={e => setMealType(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                    required
                                >
                                    {mealTypes.map(mt => (
                                        <option key={mt} value={mt}>{mt.charAt(0).toUpperCase() + mt.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-300 mb-1">Description *</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g., Grilled chicken with rice and vegetables"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Calories *</label>
                                <input
                                    type="number"
                                    value={calories}
                                    onChange={e => setCalories(e.target.value)}
                                    min="0"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Protein (g, optional)</label>
                                <input
                                    type="number"
                                    value={proteinG}
                                    onChange={e => setProteinG(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Carbs (g, optional)</label>
                                <input
                                    type="number"
                                    value={carbsG}
                                    onChange={e => setCarbsG(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Fat (g, optional)</label>
                                <input
                                    type="number"
                                    value={fatG}
                                    onChange={e => setFatG(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                        >
                            Save Meal
                        </button>
                    </form>
                </div>
            )}

            {/* Meals List by Date */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Meal History</h3>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : dailyTotals.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">
                        No meals logged yet. Add your first meal!
                    </div>
                ) : (
                    <div className="space-y-6">
                        {dailyTotals.map(day => (
                            <div key={day.date} className="space-y-3">
                                {/* Daily Totals Header */}
                                <div className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold text-white">
                                            {new Date(day.date).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </div>
                                        <div className="text-sm font-semibold text-amber-400">
                                            {day.calories} cal
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400">
                                        <span>P: {day.protein_g.toFixed(1)}g</span>
                                        <span>C: {day.carbs_g.toFixed(1)}g</span>
                                        <span>F: {day.fat_g.toFixed(1)}g</span>
                                    </div>
                                </div>

                                {/* Meals for this day */}
                                <div className="space-y-2 ml-4">
                                    {day.meals.map(meal => (
                                        <div key={meal.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
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
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}



