'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import { listInProgressSessionsForUser, listSessionsForHomeFeed } from '@/lib/fitness/workoutSessions';
import type { WorkoutSession } from '@/lib/fitness/workoutSessions';
import FitnessShortsHome from './components/FitnessShortsHome';
import { getFitnessUserProfileForUser } from '@/lib/fitness/profile';
import type { FitnessUserProfile } from '@/lib/fitness/profile';
import FitnessOnboardingWizard from './FitnessOnboardingWizard';
import { listWorkoutPlansForUser } from '@/lib/fitness/workoutPlans';
import { generatePersonalizedStarterPlanForUser } from '@/lib/fitness/personalizedPlans';
import { getCurrentProgramAssignmentForUser } from '@/lib/fitness/programEngine';
import { getOrCreateScheduledSessionForAssignment } from '@/lib/fitness/programEngine';

/** Sample grid cards for /preview/fitness */
const PREVIEW_SESSION_FEED: WorkoutSession[] = [
    {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: '00000000-0000-0000-0000-000000000001',
        plan_id: null,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        ended_at: null,
        status: 'in_progress',
        name: 'Upper body — AI walkthrough',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '00000000-0000-0000-0000-000000000001',
        plan_id: null,
        started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        ended_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
        status: 'completed',
        name: 'Leg day — full session demo',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '33333333-3333-4333-8333-333333333333',
        user_id: '00000000-0000-0000-0000-000000000001',
        plan_id: null,
        started_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        ended_at: new Date(Date.now() - 86400000 * 5 + 2700000).toISOString(),
        status: 'completed',
        name: 'Core & conditioning',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
];

export default function FitnessPage() {
    const pathname = usePathname();
    const preview = usePreview();
    const isPreview = preview.isPreview || pathname?.startsWith('/preview') === true;

    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [schemaMissing, setSchemaMissing] = useState(false);
    const [latestInProgressSession, setLatestInProgressSession] = useState<{ id: string; name: string | null; started_at: string } | null>(null);
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
    const [feedSessions, setFeedSessions] = useState<WorkoutSession[]>([]);

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
                setFeedSessions(PREVIEW_SESSION_FEED);
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
                setFeedSessions([]);
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

            try {
                const feed = await listSessionsForHomeFeed(user.id, supabase);
                setFeedSessions(feed);
            } catch {
                setFeedSessions([]);
            }
        } catch (error) {
            setFeedSessions([]);
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
        <FitnessShortsHome
            sessions={feedSessions}
            sessionsLoading={loading}
            alertSlot={
            <>
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

            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-400">{todayStr}</span>
                <span aria-hidden className="text-zinc-600">·</span>
                <Link href="/fitness/meals" className="text-amber-400/90 hover:text-amber-300">
                    Meals
                </Link>
                <Link href="/fitness/metrics" className="text-amber-400/90 hover:text-amber-300">
                    Metrics
                </Link>
                <Link href="/fitness/workouts" className="text-amber-400/90 hover:text-amber-300">
                    Workouts
                </Link>
                <Link href="/fitness/progress" className="text-amber-400/90 hover:text-amber-300">
                    Progress
                </Link>
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

            {programAssignment && !loading && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xs font-semibold text-indigo-300 mb-1">Today&apos;s scheduled workout</h3>
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

            </>
            }
        />
    );
}

















