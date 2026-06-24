'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import { isSameLocalCalendarDay } from '@/lib/newsfeed/dateRange';
import { getFitnessTodaySnapshot } from '@/lib/fitness/dailySnapshot';
import type { FitnessTodaySnapshot } from '@/lib/fitness/dailySnapshot';
import { listInProgressSessionsForUser } from '@/lib/fitness/workoutSessions';
import { getCurrentProgramAssignmentForUser, getOrCreateScheduledSessionForAssignment } from '@/lib/fitness/programEngine';
import FitnessTodayCard from '@/app/fitness/components/FitnessTodayCard';
import DashboardCollapsibleSection from './DashboardCollapsibleSection';

type ProgramAssignment = {
    scheduleEntryId: string;
    planId: string;
    dayIndex: number;
    scheduledDate: string;
    carryForward: boolean;
};

type InProgressSession = {
    id: string;
    name: string | null;
    started_at: string;
};

export default function FitnessWidget({
    selectedDate,
    userId,
}: {
    selectedDate: Date;
    userId: string | null;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [snapshot, setSnapshot] = useState<FitnessTodaySnapshot | null>(null);
    const [programAssignment, setProgramAssignment] = useState<ProgramAssignment | null>(null);
    const [inProgressSession, setInProgressSession] = useState<InProgressSession | null>(null);
    const [startingScheduledWorkout, setStartingScheduledWorkout] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    const isToday = isSameLocalCalendarDay(selectedDate, new Date());

    const loadData = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setStartError(null);
        const dateStr = formatDate(selectedDate);

        try {
            const snapshotPromise = getFitnessTodaySnapshot(userId, supabase, dateStr);

            const inProgressPromise = isToday
                ? listInProgressSessionsForUser(userId, supabase).then((sessions) => {
                      if (sessions.length === 0) return null;
                      const s = sessions[0];
                      return { id: s.id, name: s.name, started_at: s.started_at };
                  })
                : Promise.resolve(null);

            const assignmentPromise = isToday
                ? getCurrentProgramAssignmentForUser(userId, supabase).then((assignment) => {
                      if (!assignment) return null;
                      return {
                          scheduleEntryId: assignment.entry.id,
                          planId: assignment.activeProgram.plan_id,
                          dayIndex: assignment.entry.day_index,
                          scheduledDate: assignment.entry.scheduled_date,
                          carryForward: assignment.carryForward,
                      };
                  })
                : Promise.resolve(null);

            const [snapshotResult, inProgressResult, assignmentResult] = await Promise.all([
                snapshotPromise,
                inProgressPromise,
                assignmentPromise,
            ]);

            setSnapshot(snapshotResult);
            setInProgressSession(inProgressResult);
            setProgramAssignment(assignmentResult);
        } catch (error) {
            console.error('Error loading fitness data:', error);
            setSnapshot(null);
            setInProgressSession(null);
            setProgramAssignment(null);
        } finally {
            setLoading(false);
        }
    }, [userId, selectedDate, isToday]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleStartScheduledWorkout = async () => {
        if (!programAssignment || !userId) return;
        setStartingScheduledWorkout(true);
        setStartError(null);
        try {
            const started = await getOrCreateScheduledSessionForAssignment({
                userId,
                planId: programAssignment.planId,
                dayIndex: programAssignment.dayIndex,
                scheduleEntryId: programAssignment.scheduleEntryId,
                supabase,
            });
            router.push(`/fitness/sessions/${started.sessionId}`);
        } catch (err) {
            setStartError(
                err instanceof Error ? err.message : "Failed to start today's scheduled workout"
            );
        } finally {
            setStartingScheduledWorkout(false);
        }
    };

    if (!userId) return null;

    return (
        <DashboardCollapsibleSection
            title="Today's Workout"
            open={open}
            onToggle={() => setOpen((o) => !o)}
            headingSize="md"
        >
            <div className="space-y-3 p-4">
                {loading ? (
                    <div className="py-4 text-center text-sm text-slate-400">Loading…</div>
                ) : (
                    <>
                        <FitnessTodayCard
                            embedded
                            selectedDate={selectedDate}
                            snapshot={snapshot}
                            snapshotLoading={false}
                            programAssignment={isToday ? programAssignment : null}
                            inProgressSession={isToday ? inProgressSession : null}
                            startingScheduledWorkout={startingScheduledWorkout}
                            onStartScheduledWorkout={() => void handleStartScheduledWorkout()}
                        />
                        {startError ? (
                            <p className="text-xs text-red-400">{startError}</p>
                        ) : null}
                    </>
                )}
                <div className="border-t border-slate-700/80 pt-2">
                    <Link
                        href="/fitness"
                        className="text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
                    >
                        Open Fitness →
                    </Link>
                </div>
            </div>
        </DashboardCollapsibleSection>
    );
}
