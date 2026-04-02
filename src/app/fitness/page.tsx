'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import {
    listInProgressSessionsForUser,
    getProgressSummaryForUser,
    getTrainNextRecommendationForUser,
    getTrainingConsistencyForUser,
    getExecutionAdaptiveInsightsForUser,
} from '@/lib/fitness/workoutSessions';
import { getFitnessUserProfileForUser } from '@/lib/fitness/profile';
import type { FitnessUserProfile } from '@/lib/fitness/profile';
import FitnessOnboardingWizard from './FitnessOnboardingWizard';
import { listWorkoutPlansForUser } from '@/lib/fitness/workoutPlans';
import { generatePersonalizedStarterPlanForUser } from '@/lib/fitness/personalizedPlans';
import { getCurrentProgramAssignmentForUser } from '@/lib/fitness/programEngine';
import { getOrCreateScheduledSessionForAssignment } from '@/lib/fitness/programEngine';

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
    const pathname = usePathname();
    const preview = usePreview();
    const isPreview = preview.isPreview || pathname?.startsWith('/preview') === true;

    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [meals, setMeals] = useState<Meal[]>([]);
    const [metrics, setMetrics] = useState<Metric | null>(null);
    const [goals, setGoals] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [schemaMissing, setSchemaMissing] = useState(false);
    const [latestInProgressSession, setLatestInProgressSession] = useState<{ id: string; name: string | null; started_at: string } | null>(null);
    const [progressSummary, setProgressSummary] = useState<{
        completedSessionsCount: number;
        totalLoggedSets: number;
        latestCompletedSession: { id: string; name: string | null; ended_at: string | null } | null;
    } | null>(null);
    const [trainNextRecommendation, setTrainNextRecommendation] = useState<{
        recommendedMuscleSlug: string | null;
        recommendedLabel: string;
        reason: string;
        lastTrainedContext?: string;
    } | null>(null);
    const [trainingConsistency, setTrainingConsistency] = useState<{
        trainedToday: boolean;
        currentStreak: number;
    } | null>(null);
    const [executionInsights, setExecutionInsights] = useState<{
        expectedDaysPerWeek: number;
        completedDaysThisWeek: number;
        missedDaysThisWeek: number;
        recentAverageCompletionRate: number;
        suggestions: string[];
    } | null>(null);
    const [programAssignment, setProgramAssignment] = useState<{
        scheduleEntryId: string;
        planId: string;
        dayIndex: number;
        scheduledDate: string;
        carryForward: boolean;
    } | null>(null);
    const [startingScheduledWorkout, setStartingScheduledWorkout] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [fitnessProfile, setFitnessProfile] = useState<FitnessUserProfile | null>(null);
    const [hasWorkoutPlans, setHasWorkoutPlans] = useState(false);
    const [generatingStarterPlan, setGeneratingStarterPlan] = useState(false);
    const [starterPlanStatus, setStarterPlanStatus] = useState<'idle' | 'generating' | 'success' | 'failed'>('idle');
    const [starterPlanError, setStarterPlanError] = useState<string | null>(null);
    const [starterPlanId, setStarterPlanId] = useState<string | null>(null);

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
        setSchemaMissing(false);

        try {
            if (isPreview) {
                const f = preview.fitness;
                const today = new Date().toISOString().split('T')[0];
                setWorkouts((f.workouts || []).filter(w => w.date === today));
                setMeals((f.meals || []).filter(m => m.date === today));
                setMetrics(f.metrics?.[today] ?? null);
                setGoals(f.goals);
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // Gate dashboard until onboarding profile is completed.
            const profile = await getFitnessUserProfileForUser(user.id, supabase);
            if (!profile || !profile.is_onboarding_complete) {
                setShowOnboarding(true);
                setFitnessProfile(null);
                setStarterPlanStatus('idle');
                setStarterPlanError(null);
                setStarterPlanId(null);
                setLoading(false);
                return;
            }
            setShowOnboarding(false);
            setFitnessProfile(profile);

            // Read whether the user already has workout plans.
            try {
                const plans = await listWorkoutPlansForUser(user.id, supabase);
                setHasWorkoutPlans(plans.length > 0);
            } catch {
                setHasWorkoutPlans(false);
            }

            // Load today's workouts
            const { data: workoutsData, error: workoutsError } = await supabase
                .from('fitness_workouts')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .order('created_at', { ascending: false });

            if (workoutsError) throw workoutsError;

            // Load today's meals
            const { data: mealsData, error: mealsError } = await supabase
                .from('fitness_meals')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .order('created_at', { ascending: false });

            if (mealsError) throw mealsError;

            // Load today's metrics
            const { data: metricsData, error: metricsError } = await supabase
                .from('fitness_metrics')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .single();

            if (metricsError && metricsError.code !== 'PGRST116') {
                throw metricsError;
            }

            // Load goals (or create defaults)
            const { data: goalsData, error: goalsError } = await supabase
                .from('fitness_goals')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (goalsError && goalsError.code === 'PGRST116') {
                // Create default goals
                const { data: newGoals, error: insertError } = await supabase
                    .from('fitness_goals')
                    .insert({
                        user_id: user.id,
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

            // Load latest in-progress workout session (plan-based)
            try {
                const inProgress = await listInProgressSessionsForUser(user.id, supabase);
                if (inProgress.length > 0) {
                    const s = inProgress[0];
                    setLatestInProgressSession({ id: s.id, name: s.name, started_at: s.started_at });
                } else {
                    setLatestInProgressSession(null);
                }
            } catch {
                setLatestInProgressSession(null);
            }

            // Load progress summary (completed sessions)
            try {
                const progress = await getProgressSummaryForUser(user.id, supabase);
                setProgressSummary(progress);
            } catch {
                setProgressSummary(null);
            }

            // Load "what to train next" recommendation
            try {
                const rec = await getTrainNextRecommendationForUser(user.id, supabase);
                setTrainNextRecommendation(rec);
            } catch {
                setTrainNextRecommendation(null);
            }

            // Load training consistency (streak, trained today)
            try {
                const consistency = await getTrainingConsistencyForUser(user.id, supabase);
                setTrainingConsistency({
                    trainedToday: consistency.trainedToday,
                    currentStreak: consistency.currentStreak,
                });
            } catch {
                setTrainingConsistency(null);
            }

            // Load execution adherence + adaptive update guidance.
            try {
                const insights = await getExecutionAdaptiveInsightsForUser(user.id, supabase);
                setExecutionInsights(insights);
            } catch {
                setExecutionInsights(null);
            }

            // Load strict training-day assignment (includes shift-forward carry).
            try {
                const assignment = await getCurrentProgramAssignmentForUser(user.id, supabase);
                if (assignment) {
                    setProgramAssignment({
                        scheduleEntryId: assignment.entry.id,
                        planId: assignment.activeProgram.plan_id,
                        dayIndex: assignment.entry.day_index,
                        scheduledDate: assignment.entry.scheduled_date,
                        carryForward: assignment.carryForward,
                    });
                } else {
                    setProgramAssignment(null);
                }
            } catch {
                setProgramAssignment(null);
            }

            // Load weekly summary
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekStartStr = weekStart.toISOString().split('T')[0];

            // Weekly workout minutes
            const { data: weeklyWorkouts, error: weeklyError } = await supabase
                .from('fitness_workouts')
                .select('duration_minutes')
                .eq('user_id', user.id)
                .gte('date', weekStartStr);

            if (!weeklyError && weeklyWorkouts) {
                // Store for display (we'll show this in summary)
                // For now, just load it but don't display yet
            }
        } catch (error) {
            const err = error as Record<string, unknown> | null;
            const errMessage = (error instanceof Error && error.message) || (err && typeof err.message === 'string' ? err.message : null);
            const errCode = err && typeof err.code === 'string' ? err.code : null;
            const errDetails = err && typeof err.details === 'string' ? err.details : null;
            // Table/schema not in PostgREST cache – migrations likely not run
            if (errCode === 'PGRST205') {
                setSchemaMissing(true);
                setNotification('Fitness tables are not set up yet. Run database migrations (e.g. supabase db push) to enable this page.');
            } else {
                const message = errMessage ?? (errCode ? `Request failed (${errCode})` : null) ?? 'Failed to load dashboard data';
                setNotification(message);
                const payload: Record<string, unknown> = { message: errMessage, code: errCode, details: errDetails };
                if (err && typeof err === 'object') {
                    for (const key of Object.keys(err)) {
                        if (!(key in payload)) payload[key] = err[key];
                    }
                }
                console.error('Error loading dashboard data:', JSON.stringify(payload, null, 2));
            }
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

    if (!loading && schemaMissing) {
        return (
            <section className="px-6 py-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-6 text-center">
                    <p className="font-medium text-amber-200">Fitness data not set up</p>
                    <p className="mt-2 text-sm text-slate-300">
                        The fitness tables are missing from the database. Run migrations to create them.
                    </p>
                    <p className="mt-3 font-mono text-xs text-slate-400">
                        supabase db push
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        From your project root with Supabase CLI linked to this project.
                    </p>
                </div>
            </section>
        );
    }

    if (!loading && showOnboarding) {
        return (
            <section className="px-6 py-4">
                <FitnessOnboardingWizard
                    onCompleted={async () => {
                        setShowOnboarding(false);
                        setStarterPlanStatus('generating');
                        setStarterPlanError(null);
                        setStarterPlanId(null);
                        setLoading(true);
                        setNotification(null);
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) {
                                window.location.href = '/login';
                                return;
                            }
                            const profile = await getFitnessUserProfileForUser(user.id, supabase);
                            if (!profile || !profile.is_onboarding_complete) {
                                setStarterPlanStatus('failed');
                                setStarterPlanError('Onboarding profile was not found after save. Please try again.');
                                return;
                            }
                            setFitnessProfile(profile);
                            const created = await generatePersonalizedStarterPlanForUser(user.id, profile, supabase);
                            setStarterPlanStatus('success');
                            setStarterPlanId(created.id);
                            setHasWorkoutPlans(true);
                        } catch (err) {
                            setStarterPlanStatus('failed');
                            setStarterPlanError(
                                err instanceof Error
                                    ? err.message
                                    : 'We could not auto-generate your starter plan yet.'
                            );
                            setHasWorkoutPlans(false);
                        } finally {
                            await loadDashboardData();
                            setLoading(false);
                        }
                    }}
                />
            </section>
        );
    }

    return (
        <section className="space-y-6 px-6 py-4">
            {starterPlanStatus === 'generating' && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-4">
                    <h3 className="text-sm font-semibold text-sky-300">Creating your personalized starter plan...</h3>
                    <p className="mt-1 text-xs text-slate-300">
                        This uses your onboarding answers to generate your first tailored plan.
                    </p>
                </div>
            )}

            {starterPlanStatus === 'success' && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-emerald-300">Your starter plan is ready</h3>
                            <p className="mt-1 text-xs text-slate-300">
                                We auto-generated your first personalized workout plan from your onboarding profile.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href={starterPlanId ? `/fitness/plans/${starterPlanId}` : '/fitness/plans'}
                                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
                            >
                                Open starter plan
                            </Link>
                            <Link
                                href="/fitness/plans"
                                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                                View all plans
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {starterPlanStatus === 'failed' && !hasWorkoutPlans && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-red-300">We could not auto-generate your starter plan</h3>
                            <p className="mt-1 text-xs text-slate-300">
                                {starterPlanError ?? 'You can still generate it manually below.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={generatingStarterPlan}
                            onClick={async () => {
                                if (!fitnessProfile) return;
                                setGeneratingStarterPlan(true);
                                setNotification(null);
                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) {
                                        window.location.href = '/login';
                                        return;
                                    }
                                    const created = await generatePersonalizedStarterPlanForUser(
                                        user.id,
                                        fitnessProfile,
                                        supabase
                                    );
                                    setStarterPlanStatus('success');
                                    setStarterPlanId(created.id);
                                    setHasWorkoutPlans(true);
                                    window.location.href = `/fitness/plans/${created.id}`;
                                } catch (err) {
                                    setStarterPlanError(
                                        err instanceof Error
                                            ? err.message
                                            : 'Failed to generate your personalized starter plan'
                                    );
                                } finally {
                                    setGeneratingStarterPlan(false);
                                }
                            }}
                            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {generatingStarterPlan ? 'Generating...' : 'Generate manually'}
                        </button>
                    </div>
                </div>
            )}

            {!loading && fitnessProfile && !hasWorkoutPlans && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-amber-300">Your personalized starter plan</h3>
                            <p className="mt-1 text-xs text-slate-300">
                                We can generate your first tailored plan from your onboarding profile.
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={generatingStarterPlan || starterPlanStatus === 'generating'}
                            onClick={async () => {
                                if (!fitnessProfile) return;
                                setGeneratingStarterPlan(true);
                                setNotification(null);
                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) {
                                        window.location.href = '/login';
                                        return;
                                    }
                                    const created = await generatePersonalizedStarterPlanForUser(
                                        user.id,
                                        fitnessProfile,
                                        supabase
                                    );
                                    setStarterPlanStatus('success');
                                    setStarterPlanId(created.id);
                                    setHasWorkoutPlans(true);
                                    window.location.href = `/fitness/plans/${created.id}`;
                                } catch (err) {
                                    setNotification(
                                        err instanceof Error
                                            ? err.message
                                            : 'Failed to generate your personalized starter plan'
                                    );
                                } finally {
                                    setGeneratingStarterPlan(false);
                                }
                            }}
                            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {generatingStarterPlan ? 'Generating...' : 'Generate starter plan'}
                        </button>
                    </div>
                </div>
            )}

            {notification && !schemaMissing && (
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

            {/* Resume latest session */}
            {latestInProgressSession && !loading && (
                <div className="rounded-lg border-2 border-emerald-500 bg-emerald-950/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-emerald-400">In progress</p>
                            <p className="mt-0.5 text-sm font-semibold text-white">
                                {latestInProgressSession.name || 'Workout Session'}
                            </p>
                            <p className="text-xs text-slate-400">
                                Started {new Date(latestInProgressSession.started_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                        <Link
                            href={`/fitness/sessions/${latestInProgressSession.id}`}
                            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                        >
                            Continue session
                        </Link>
                    </div>
                </div>
            )}

            {/* Session progress summary */}
            {progressSummary && (progressSummary.completedSessionsCount > 0 || progressSummary.totalLoggedSets > 0) && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-slate-400">Session progress</h3>
                        <Link
                            href="/fitness/sessions"
                            className="text-xs font-medium text-amber-400 hover:text-amber-300"
                        >
                            View all sessions
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <div className="text-xs text-slate-500">Completed sessions</div>
                            <div className="text-lg font-semibold text-white">{progressSummary.completedSessionsCount}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Total logged sets</div>
                            <div className="text-lg font-semibold text-white">{progressSummary.totalLoggedSets}</div>
                        </div>
                        {progressSummary.latestCompletedSession && (
                            <div>
                                <div className="text-xs text-slate-500">Latest workout</div>
                                <Link
                                    href={`/fitness/sessions/${progressSummary.latestCompletedSession.id}`}
                                    className="text-sm font-medium text-amber-400 hover:text-amber-300 truncate block"
                                >
                                    {progressSummary.latestCompletedSession.name || 'Session'}
                                </Link>
                                <div className="text-[11px] text-slate-500">
                                    {progressSummary.latestCompletedSession.ended_at
                                        ? new Date(progressSummary.latestCompletedSession.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : '—'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Training consistency */}
            {trainingConsistency && !loading && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h3 className="text-xs font-semibold text-slate-400 mb-2">Consistency</h3>
                    <div className="flex flex-wrap items-baseline gap-4">
                        <div>
                            <span className="text-xs text-slate-500">Trained today</span>
                            <span className="ml-2 text-sm font-medium text-white">
                                {trainingConsistency.trainedToday ? 'Yes' : 'Not yet'}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500">Current streak</span>
                            <span className="ml-2 text-sm font-medium text-white">
                                {trainingConsistency.currentStreak} day{trainingConsistency.currentStreak !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    {!trainingConsistency.trainedToday && (
                        <p className="text-[11px] text-slate-500 mt-2">
                            Complete a workout today to extend your streak.
                        </p>
                    )}
                </div>
            )}

            {programAssignment && !loading && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xs font-semibold text-indigo-300 mb-1">Today's scheduled workout</h3>
                            <p className="text-sm font-medium text-white">
                                Day {programAssignment.dayIndex}
                                {programAssignment.carryForward ? ' (carry-forward)' : ''}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                Scheduled: {new Date(`${programAssignment.scheduledDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={startingScheduledWorkout}
                                onClick={async () => {
                                    setStartingScheduledWorkout(true);
                                    setNotification(null);
                                    try {
                                        const { data: { user } } = await supabase.auth.getUser();
                                        if (!user) {
                                            window.location.href = '/login';
                                            return;
                                        }
                                        const started = await getOrCreateScheduledSessionForAssignment({
                                            userId: user.id,
                                            planId: programAssignment.planId,
                                            dayIndex: programAssignment.dayIndex,
                                            scheduleEntryId: programAssignment.scheduleEntryId,
                                            supabase,
                                        });
                                        window.location.href = `/fitness/sessions/${started.sessionId}`;
                                    } catch (err) {
                                        setNotification(
                                            err instanceof Error
                                                ? err.message
                                                : 'Failed to start today\'s scheduled workout'
                                        );
                                    } finally {
                                        setStartingScheduledWorkout(false);
                                    }
                                }}
                                className="rounded-md bg-indigo-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-indigo-300 disabled:opacity-60"
                            >
                                {startingScheduledWorkout ? 'Starting…' : 'Start today\'s workout'}
                            </button>
                            <Link
                                href={`/fitness/plans/${programAssignment.planId}`}
                                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                                View plan
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {executionInsights && !loading && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h3 className="text-xs font-semibold text-slate-400 mb-2">Execution & adaptive updates</h3>
                    <div className="flex flex-wrap items-baseline gap-4">
                        <div>
                            <span className="text-xs text-slate-500">Completed days (7d)</span>
                            <span className="ml-2 text-sm font-medium text-white">
                                {executionInsights.completedDaysThisWeek}/{executionInsights.expectedDaysPerWeek}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500">Missed days</span>
                            <span className="ml-2 text-sm font-medium text-white">
                                {executionInsights.missedDaysThisWeek}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500">Avg completion</span>
                            <span className="ml-2 text-sm font-medium text-white">
                                {executionInsights.recentAverageCompletionRate}%
                            </span>
                        </div>
                    </div>
                    {executionInsights.suggestions.length > 0 && (
                        <p className="mt-2 text-[11px] text-slate-500">
                            {executionInsights.suggestions[0]}
                        </p>
                    )}
                </div>
            )}

            {/* What to train next */}
            {trainNextRecommendation && !loading && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h3 className="text-xs font-semibold text-slate-400 mb-2">What to train next</h3>
                    {trainNextRecommendation.recommendedMuscleSlug ? (
                        <>
                            <p className="text-sm font-medium text-white">
                                {trainNextRecommendation.recommendedLabel}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {trainNextRecommendation.reason}
                            </p>
                            {trainNextRecommendation.lastTrainedContext && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {trainNextRecommendation.lastTrainedContext}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Link
                                    href={`/fitness/workout-generator?muscle=${encodeURIComponent(trainNextRecommendation.recommendedMuscleSlug)}`}
                                    className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                                >
                                    Generate workout
                                </Link>
                                <Link
                                    href={`/fitness/exercises?muscle=${encodeURIComponent(trainNextRecommendation.recommendedMuscleSlug)}`}
                                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                >
                                    Browse exercises
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-slate-300">Get started</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {trainNextRecommendation.reason}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Link
                                    href="/fitness/plans"
                                    className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
                                >
                                    Browse plans
                                </Link>
                                <Link
                                    href="/fitness/workout-generator"
                                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                                >
                                    Workout generator
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}

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

















