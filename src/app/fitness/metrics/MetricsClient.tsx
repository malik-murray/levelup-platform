'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@auth/supabaseClient';

type Metric = {
    id: string;
    date: string;
    weight_kg: number | null;
    steps: number | null;
    water_ml: number | null;
    sleep_hours: number | null;
};

type MetricsClientProps = {
    initialDate?: string;
    initialShowForm?: boolean;
};

export default function MetricsClient({ initialDate, initialShowForm = false }: MetricsClientProps) {
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(initialShowForm);
    const [date, setDate] = useState(
        initialDate === 'today' || !initialDate 
            ? new Date().toISOString().split('T')[0] 
            : initialDate
    );
    const [weightKg, setWeightKg] = useState('');
    const [steps, setSteps] = useState('');
    const [waterMl, setWaterMl] = useState('');
    const [sleepHours, setSleepHours] = useState('');

    // Load recent metrics for chart
    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        setLoading(true);
        setNotification(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // Load last 30 days of metrics for chart
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];

            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('fitness_metrics')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .order('date', { ascending: false })
                .limit(30);

            if (error) throw error;
            setMetrics((data as Metric[]) || []);

            // Load today's metrics to populate form if exists
            const today = new Date().toISOString().split('T')[0];
            const { data: todayData } = await supabase
                .from('fitness_metrics')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .single();

            if (todayData) {
                setWeightKg(todayData.weight_kg?.toString() || '');
                setSteps(todayData.steps?.toString() || '');
                setWaterMl(todayData.water_ml?.toString() || '');
                setSleepHours(todayData.sleep_hours?.toString() || '');
            }
        } catch (error) {
            console.error('Error loading metrics:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load metrics');
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

            // Check if metric exists for this date
            const { data: existing } = await supabase
                .from('fitness_metrics')
                .select('id')
                .eq('user_id', user.id)
                .eq('date', date)
                .single();

            const metricData = {
                user_id: user.id,
                date,
                weight_kg: weightKg ? parseFloat(weightKg) : null,
                steps: steps ? parseInt(steps) : null,
                water_ml: waterMl ? parseInt(waterMl) : null,
                sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
            };

            let error;
            if (existing) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('fitness_metrics')
                    .update(metricData)
                    .eq('id', existing.id)
                    .eq('user_id', user.id);
                error = updateError;
            } else {
                // Insert new
                const { error: insertError } = await supabase
                    .from('fitness_metrics')
                    .insert(metricData);
                error = insertError;
            }

            if (error) throw error;

            setNotification(existing ? 'Metrics updated successfully!' : 'Metrics saved successfully!');
            setShowForm(false);
            await loadMetrics();
        } catch (error) {
            console.error('Error saving metrics:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to save metrics');
        }
    };

    // Prepare data for simple chart (weight over time)
    const weightData = useMemo(() => {
        return metrics
            .filter(m => m.weight_kg !== null)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-14); // Last 14 days
    }, [metrics]);

    // Calculate weekly workout minutes (we'll show this as a placeholder for now)
    const weeklyMinutes = useMemo(() => {
        // This would come from workouts, but for now we'll show a placeholder
        return 0;
    }, []);

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
                    <h2 className="text-2xl font-bold text-white dark:text-white">Metrics</h2>
                    <p className="text-xs text-slate-400 mt-1">Track your progress over time</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    {showForm ? 'Cancel' : 'Log Metrics'}
                </button>
            </div>

            {/* Log Metrics Form */}
            {showForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h3 className="text-sm font-semibold mb-4">Log Metrics</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Weight (kg, optional)</label>
                                <input
                                    type="number"
                                    value={weightKg}
                                    onChange={e => setWeightKg(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    placeholder="70.5"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Steps (optional)</label>
                                <input
                                    type="number"
                                    value={steps}
                                    onChange={e => setSteps(e.target.value)}
                                    min="0"
                                    placeholder="10000"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Water (ml, optional)</label>
                                <input
                                    type="number"
                                    value={waterMl}
                                    onChange={e => setWaterMl(e.target.value)}
                                    min="0"
                                    placeholder="2500"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300 mb-1">Sleep (hours, optional)</label>
                                <input
                                    type="number"
                                    value={sleepHours}
                                    onChange={e => setSleepHours(e.target.value)}
                                    min="0"
                                    max="24"
                                    step="0.5"
                                    placeholder="8.0"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                        >
                            Save Metrics
                        </button>
                    </form>
                </div>
            )}

            {/* Weight Chart */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                <h3 className="text-sm font-semibold mb-4">Weight Trend (Last 14 Days)</h3>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : weightData.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">
                        No weight data yet. Log your weight to see the trend.
                    </div>
                ) : (
                    <div className="h-64 rounded-md border border-slate-800 bg-slate-900 flex items-end justify-around p-4 gap-1">
                        {weightData.map((metric, idx) => {
                            const maxWeight = Math.max(...weightData.map(m => m.weight_kg!));
                            const minWeight = Math.min(...weightData.map(m => m.weight_kg!));
                            const range = maxWeight - minWeight || 1;
                            const height = ((metric.weight_kg! - minWeight) / range) * 100;
                            
                            return (
                                <div key={metric.id} className="flex flex-col items-center flex-1">
                                    <div
                                        className="w-full bg-amber-400 rounded-t transition-all hover:bg-amber-300"
                                        style={{ height: `${Math.max(5, height)}%` }}
                                        title={`${metric.weight_kg} kg - ${new Date(metric.date).toLocaleDateString()}`}
                                    />
                                    <div className="text-[8px] text-slate-500 mt-1">
                                        {new Date(metric.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {weightData.length > 0 && (
                    <div className="mt-4 text-xs text-slate-400 text-center">
                        Latest: {weightData[weightData.length - 1].weight_kg} kg
                    </div>
                )}
            </div>

            {/* Recent Metrics List */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Recent Metrics</h3>
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : metrics.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">
                        No metrics logged yet. Start tracking your progress!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {metrics.slice(0, 14).map(metric => (
                            <div key={metric.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-white">
                                        {new Date(metric.date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400">
                                        {metric.weight_kg && <span>Weight: {metric.weight_kg} kg</span>}
                                        {metric.steps && <span>Steps: {metric.steps.toLocaleString()}</span>}
                                        {metric.water_ml && <span>Water: {(metric.water_ml / 1000).toFixed(1)}L</span>}
                                        {metric.sleep_hours && <span>Sleep: {metric.sleep_hours}h</span>}
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







