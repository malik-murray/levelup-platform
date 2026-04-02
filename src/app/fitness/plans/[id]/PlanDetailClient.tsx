'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutPlanWithItems, WorkoutPlanItem } from '@/lib/fitness/workoutPlans';
import {
    getWorkoutPlanWithItems,
    updateWorkoutPlanMeta,
    deleteWorkoutPlan,
    duplicateWorkoutPlan,
    duplicateWorkoutPlanDay,
    reorderWorkoutPlanItems,
    updateWorkoutPlanItem,
    updateWorkoutPlanItemExercise,
    removeWorkoutPlanItem,
    addWorkoutPlanItem,
} from '@/lib/fitness/workoutPlans';
import { createSessionFromPlan } from '@/lib/fitness/workoutSessions';
import { getExerciseNamesBySlugs, formatSlugAsTitle, getPublishedExercises } from '@/lib/fitness/exercises';
import type { ExerciseWithRelations } from '@/lib/fitness/types';

type PlanDetailClientProps = {
    id: string;
};

type PlanItemRowProps = {
    item: WorkoutPlanItem;
    index: number;
    totalItems: number;
    exerciseName: string;
    reordering: boolean;
    onReorderUp: () => Promise<void>;
    onReorderDown: () => Promise<void>;
    editingItemId: string | null;
    editItemValues: { sets: string; rep_range: string; rest_seconds: string; note: string };
    savingItemId: string | null;
    itemSaveError: string | null;
    removingItemId: string | null;
    onEdit: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => Promise<void>;
    onEditValuesChange: (v: { sets: string; rep_range: string; rest_seconds: string; note: string }) => void;
    onRemove: () => Promise<void>;
    onSwap: () => Promise<void>;
    swapping: boolean;
};

function PlanItemRow({
    item,
    index,
    totalItems,
    exerciseName,
    reordering,
    onReorderUp,
    onReorderDown,
    editingItemId,
    editItemValues,
    savingItemId,
    itemSaveError,
    removingItemId,
    onEdit,
    onCancelEdit,
    onSaveEdit,
    onEditValuesChange,
    onRemove,
    onSwap,
    swapping,
}: PlanItemRowProps) {
    const isEditing = editingItemId === item.id;
    const isSaving = savingItemId === item.id;
    const isRemoving = removingItemId === item.id;
    const isBusy = reordering || isSaving || isRemoving;

    return (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                    href={`/fitness/exercises/${encodeURIComponent(item.exercise_slug)}`}
                    className="font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                >
                    {exerciseName}
                </Link>
                {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px]">
                            Sets:
                            <input
                                type="number"
                                min={1}
                                value={editItemValues.sets}
                                onChange={(e) => onEditValuesChange({ ...editItemValues, sets: e.target.value })}
                                className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <label className="flex items-center gap-1 text-[11px]">
                            Reps:
                            <input
                                type="text"
                                value={editItemValues.rep_range}
                                onChange={(e) => onEditValuesChange({ ...editItemValues, rep_range: e.target.value })}
                                placeholder="e.g. 8–12"
                                className="w-20 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <label className="flex items-center gap-1 text-[11px]">
                            Rest (sec):
                            <input
                                type="number"
                                min={0}
                                value={editItemValues.rest_seconds}
                                onChange={(e) => onEditValuesChange({ ...editItemValues, rest_seconds: e.target.value })}
                                className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <label className="flex flex-col gap-0.5 text-[11px] w-full sm:max-w-xs">
                            <span className="text-slate-500 dark:text-slate-400">Note</span>
                            <textarea
                                rows={2}
                                value={editItemValues.note}
                                onChange={(e) => onEditValuesChange({ ...editItemValues, note: e.target.value })}
                                placeholder="Optional coaching tip…"
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={onSaveEdit}
                                className="rounded border border-amber-500 bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-black hover:bg-amber-400 disabled:opacity-60 dark:bg-amber-400 dark:text-black"
                            >
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                type="button"
                                disabled={isSaving}
                                onClick={onCancelEdit}
                                className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span><span className="font-semibold">Sets:</span> {item.sets}</span>
                            <span><span className="font-semibold">Reps:</span> {item.rep_range}</span>
                            <span><span className="font-semibold">Rest:</span> {item.rest_seconds} sec</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                disabled={isBusy || index === 0}
                                onClick={onReorderUp}
                                className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                title="Move up"
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                disabled={isBusy || index === totalItems - 1}
                                onClick={onReorderDown}
                                className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                title="Move down"
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={onEdit}
                                className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                title="Edit"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={onSwap}
                                className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
                                title="Swap exercise"
                            >
                                {swapping ? 'Swapping…' : 'Swap'}
                            </button>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={onRemove}
                                className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                                title="Remove"
                            >
                                {isRemoving ? '…' : 'Remove'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {!isEditing && (
                <>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        {item.movement_pattern && (
                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                Pattern: {item.movement_pattern}
                            </span>
                        )}
                        {item.mechanic && (
                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                Mechanic: {item.mechanic}
                            </span>
                        )}
                    </div>
                    {item.note && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{item.note}</p>
                    )}
                </>
            )}
            {itemSaveError && editingItemId === item.id && (
                <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{itemSaveError}</p>
            )}
        </div>
    );
}

function formatDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export default function PlanDetailClient({ id }: PlanDetailClientProps) {
    const [plan, setPlan] = useState<WorkoutPlanWithItems | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [startingSession, setStartingSession] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
    const [reordering, setReordering] = useState(false);
    const [reorderError, setReorderError] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemValues, setEditItemValues] = useState<{ sets: string; rep_range: string; rest_seconds: string; note: string }>({
        sets: '',
        rep_range: '',
        rest_seconds: '',
        note: '',
    });
    const [savingItemId, setSavingItemId] = useState<string | null>(null);
    const [itemSaveError, setItemSaveError] = useState<string | null>(null);
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);
    const [addExerciseOpen, setAddExerciseOpen] = useState(false);
    const [addExerciseSearch, setAddExerciseSearch] = useState('');
    const [addExerciseList, setAddExerciseList] = useState<ExerciseWithRelations[]>([]);
    const [addExerciseSelected, setAddExerciseSelected] = useState<ExerciseWithRelations | null>(null);
    const [addExerciseSets, setAddExerciseSets] = useState('3');
    const [addExerciseReps, setAddExerciseReps] = useState('8–12');
    const [addExerciseRest, setAddExerciseRest] = useState('60');
    const [addExerciseNote, setAddExerciseNote] = useState('');
    const [addExerciseSaving, setAddExerciseSaving] = useState(false);
    const [addExerciseError, setAddExerciseError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState(1);
    const [duplicatingDay, setDuplicatingDay] = useState<number | null>(null);
    const [swappingItemId, setSwappingItemId] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<ExerciseWithRelations[]>([]);
    const [adaptMissedDays, setAdaptMissedDays] = useState('0');
    const [adaptSoreMuscles, setAdaptSoreMuscles] = useState('');
    const [adaptEquipment, setAdaptEquipment] = useState<string[]>([]);
    const [adapting, setAdapting] = useState(false);
    const [adaptMessage, setAdaptMessage] = useState<string | null>(null);

    const loadExercisesForAdd = useCallback(async () => {
        try {
            const exercises = await getPublishedExercises(supabase);
            setAddExerciseList(exercises);
            setCatalog(exercises);
        } catch (e) {
            console.error('Load exercises for add:', e);
            setAddExerciseList([]);
            setCatalog([]);
        }
    }, []);

    useEffect(() => {
        if (addExerciseOpen) loadExercisesForAdd();
    }, [addExerciseOpen, loadExercisesForAdd]);

    const addExerciseFiltered = addExerciseSearch.trim()
        ? addExerciseList.filter((ex) =>
              ex.name.toLowerCase().includes(addExerciseSearch.trim().toLowerCase())
          )
        : addExerciseList;

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setError(null);
            setPlan(undefined);
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    window.location.href = '/login';
                    return;
                }

                const data = await getWorkoutPlanWithItems(id, supabase);
                if (cancelled) return;
                setPlan(data);
                if (data?.items?.length) {
                    const slugs = [...new Set(data.items.map((i) => i.exercise_slug))];
                    const names = await getExerciseNamesBySlugs(slugs, supabase);
                    if (!cancelled) setExerciseNames(names);
                } else {
                    setExerciseNames({});
                }
            } catch (e) {
                console.error('Error loading workout plan detail:', e);
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Failed to load workout plan');
                setPlan(null);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (plan === undefined && !error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading plan…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (plan === null) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Plan not found or you do not have access to it.
                </div>
            </div>
        );
    }

    // Extra narrowing for TypeScript (we handled `plan === undefined` and `plan === null` above).
    if (!plan) return null;

    // At this point `plan` is guaranteed to be loaded (we returned for `plan === null` and `plan === undefined` above).
    const itemCount = plan!.items.length;
    const dayIndexes = [...new Set(plan.items.map((i) => i.day_index || 1))].sort((a, b) => a - b);
    const activeDay = dayIndexes.includes(selectedDay) ? selectedDay : (dayIndexes[0] ?? 1);
    const dayItems = plan.items.filter((i) => (i.day_index || 1) === activeDay);
    const muscleParam =
        plan!.muscle_slugs.length > 0
            ? `muscle=${encodeURIComponent(plan!.muscle_slugs[0])}`
            : '';
    const difficultyParam =
        plan!.difficulty && ['beginner', 'intermediate', 'advanced'].includes(plan!.difficulty)
            ? `difficulty=${encodeURIComponent(plan!.difficulty)}`
            : '';
    const generatorParams = [muscleParam, difficultyParam].filter(Boolean).join('&');
    const generatorHref = generatorParams
        ? `/fitness/workout-generator?${generatorParams}`
        : '/fitness/workout-generator';

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {editMode ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    ) : (
                        plan.name
                    )}
                </h1>
                {editMode ? (
                    <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        placeholder="Optional description of how or when to use this plan."
                        className="w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                ) : (
                    plan.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {plan.description}
                        </p>
                    )
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    {plan.muscle_slugs.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Muscles: {plan.muscle_slugs.join(', ')}
                        </span>
                    )}
                    {plan.difficulty && (
                        <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Difficulty: {plan.difficulty}
                        </span>
                    )}
                    <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Items: {itemCount}
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Created: {formatDate(plan.created_at)} • Updated: {formatDate(plan.updated_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {!editMode && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditName(plan.name);
                                setEditDescription(plan.description ?? '');
                                setSaveMessage(null);
                                setError(null);
                                setEditMode(true);
                            }}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Edit plan
                        </button>
                    )}
                    {editMode && (
                        <>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                    setSaveMessage(null);
                                    const trimmedName = editName.trim();
                                    if (!trimmedName) {
                                        setError('Plan name is required.');
                                        return;
                                    }
                                    try {
                                        setSaving(true);
                                        const updated = await updateWorkoutPlanMeta(
                                            plan.id,
                                            {
                                                name: trimmedName,
                                                description: editDescription,
                                            },
                                            supabase
                                        );
                                        setPlan({ ...plan, ...updated });
                                        setSaveMessage('Plan details updated.');
                                        setError(null);
                                        setEditMode(false);
                                    } catch (e) {
                                        console.error('Update plan meta error:', e);
                                        setError(
                                            e instanceof Error ? e.message : 'Failed to update plan'
                                        );
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1 font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300 disabled:opacity-60"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditMode(false);
                                    setError(null);
                                    setSaveMessage(null);
                                }}
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        disabled={duplicating || editMode}
                        onClick={async () => {
                            try {
                                setDuplicating(true);
                                setError(null);
                                const duplicated = await duplicateWorkoutPlan(plan.id, undefined, supabase);
                                window.location.href = `/fitness/plans/${duplicated.id}`;
                            } catch (e) {
                                console.error('Duplicate plan error:', e);
                                setError(
                                    e instanceof Error ? e.message : 'Failed to duplicate plan'
                                );
                            } finally {
                                setDuplicating(false);
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                        {duplicating ? 'Duplicating…' : 'Duplicate plan'}
                    </button>
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={async () => {
                            const confirmed = window.confirm(
                                'Delete this plan? This cannot be undone.'
                            );
                            if (!confirmed) return;
                            try {
                                setDeleting(true);
                                await deleteWorkoutPlan(plan.id, supabase);
                                window.location.href = '/fitness/plans';
                            } catch (e) {
                                console.error('Delete workout plan error:', e);
                                setError(
                                    e instanceof Error ? e.message : 'Failed to delete plan'
                                );
                            } finally {
                                setDeleting(false);
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1 font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900 disabled:opacity-60"
                    >
                        {deleting ? 'Deleting…' : 'Delete plan'}
                    </button>
                </div>
                {saveMessage && (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        {saveMessage}
                    </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <button
                        type="button"
                        disabled={startingSession || itemCount === 0}
                        onClick={async () => {
                            setSessionError(null);
                            try {
                                setStartingSession(true);
                                const { data: { user }, error: authError } = await supabase.auth.getUser();
                                if (authError || !user) {
                                    window.location.href = '/login';
                                    return;
                                }
                                const session = await createSessionFromPlan(plan.id, user.id, supabase);
                                window.location.href = `/fitness/sessions/${session.id}`;
                            } catch (e) {
                                console.error('Start session error:', e);
                                setSessionError(
                                    e instanceof Error ? e.message : 'Failed to start session from this plan'
                                );
                            } finally {
                                setStartingSession(false);
                            }
                        }}
                        className="inline-flex items-center rounded-md bg-amber-500 px-3 py-2 font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300 disabled:opacity-60"
                    >
                        {startingSession ? 'Starting…' : 'Start session'}
                    </button>
                    <Link
                        href={generatorHref}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        Load into generator
                    </Link>
                </div>
                {sessionError && (
                    <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                        {sessionError}
                    </p>
                )}
                {itemCount === 0 && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Add exercises via the generator, then start a session.
                    </p>
                )}
            </header>

            <section className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900 space-y-2">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Week overview</h2>
                    <div className="flex flex-wrap gap-2">
                        {dayIndexes.map((d) => {
                            const count = plan.items.filter((i) => (i.day_index || 1) === d).length;
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setSelectedDay(d)}
                                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                                        activeDay === d
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    Day {d} ({count})
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            disabled={duplicatingDay !== null || dayIndexes.length >= 7}
                            onClick={async () => {
                                setDuplicatingDay(activeDay);
                                setError(null);
                                try {
                                    const added = await duplicateWorkoutPlanDay(plan.id, activeDay, supabase);
                                    const nextPlan = { ...plan, items: [...plan.items, ...added] };
                                    setPlan(nextPlan);
                                    const maxDay = nextPlan.items.reduce((m, i) => Math.max(m, i.day_index || 1), 1);
                                    setSelectedDay(maxDay);
                                } catch (e) {
                                    setError(e instanceof Error ? e.message : 'Failed to duplicate day');
                                } finally {
                                    setDuplicatingDay(null);
                                }
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            {duplicatingDay ? 'Duplicating day…' : '+ Duplicate day'}
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Core intent is locked by day focus. You can still customize exercises, order, sets, and notes.
                    </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900 space-y-2">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Adapt this plan</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <label className="text-xs text-slate-600 dark:text-slate-300">
                            Missed training days this week
                            <input
                                type="number"
                                min={0}
                                max={7}
                                value={adaptMissedDays}
                                onChange={(e) => setAdaptMissedDays(e.target.value)}
                                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300 md:col-span-2">
                            Sore muscles (comma-separated slugs, e.g. quads, shoulders)
                            <input
                                type="text"
                                value={adaptSoreMuscles}
                                onChange={(e) => setAdaptSoreMuscles(e.target.value)}
                                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                            />
                        </label>
                    </div>
                    <div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Available equipment</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {['dumbbells', 'barbell', 'machines', 'resistance-bands', 'kettlebells', 'pull-up-bar', 'bodyweight'].map((eq) => (
                                <button
                                    key={eq}
                                    type="button"
                                    onClick={() => {
                                        setAdaptEquipment((prev) =>
                                            prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq]
                                        );
                                    }}
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                                        adaptEquipment.includes(eq)
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    {eq}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={adapting}
                            onClick={async () => {
                                setAdapting(true);
                                setAdaptMessage(null);
                                setError(null);
                                try {
                                    const soreSet = new Set(
                                        adaptSoreMuscles
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                    );
                                    const missedDays = Math.max(0, Math.min(7, parseInt(adaptMissedDays || '0', 10) || 0));
                                    let changed = 0;
                                    for (const item of plan.items) {
                                        const ex = catalog.find((c) => c.slug === item.exercise_slug);
                                        // equipment adaptation: swap same primary muscle to allowed equipment
                                        if (adaptEquipment.length > 0 && ex?.equipment?.slug && !adaptEquipment.includes(ex.equipment.slug)) {
                                            const replacement = catalog.find((c) =>
                                                c.slug !== ex.slug &&
                                                c.primary_muscle_group?.slug === ex.primary_muscle_group?.slug &&
                                                (!!c.equipment?.slug ? adaptEquipment.includes(c.equipment.slug) : adaptEquipment.includes('bodyweight'))
                                            );
                                            if (replacement) {
                                                const updated = await updateWorkoutPlanItemExercise(item.id, replacement.slug, supabase);
                                                setPlan((p) => ({ ...p!, items: p!.items.map((i) => (i.id === item.id ? updated : i)) }));
                                                changed++;
                                            }
                                        }
                                        // missed days / soreness adaptation: reduce set count (simple deterministic deload)
                                        const shouldDeload =
                                            missedDays >= 2 ||
                                            (!!ex?.primary_muscle_group?.slug && soreSet.has(ex.primary_muscle_group.slug));
                                        if (shouldDeload && item.sets > 2) {
                                            const updated = await updateWorkoutPlanItem(
                                                item.id,
                                                { sets: Math.max(2, item.sets - 1) },
                                                supabase
                                            );
                                            setPlan((p) => ({ ...p!, items: p!.items.map((i) => (i.id === item.id ? updated : i)) }));
                                            changed++;
                                        }
                                    }
                                    setAdaptMessage(changed > 0 ? `Applied ${changed} adaptation updates.` : 'No changes were needed.');
                                } catch (e) {
                                    setError(e instanceof Error ? e.message : 'Failed to apply adaptation');
                                } finally {
                                    setAdapting(false);
                                }
                            }}
                            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400 disabled:opacity-60"
                        >
                            {adapting ? 'Applying…' : 'Apply adaptation'}
                        </button>
                        {adaptMessage && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">{adaptMessage}</span>
                        )}
                    </div>
                </div>

                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Day {activeDay} items
                </h2>
                {reorderError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                        {reorderError}
                    </p>
                )}
                {itemCount === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        This plan has no items yet.
                    </p>
                ) : (
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800 dark:text-slate-100">
                        {dayItems.map((item, index) => (
                            <li key={item.id}>
                                <PlanItemRow
                                    item={item}
                                    index={index}
                                    totalItems={dayItems.length}
                                    exerciseName={exerciseNames[item.exercise_slug] ?? formatSlugAsTitle(item.exercise_slug)}
                                    reordering={reordering}
                                    onReorderUp={async () => {
                                        setReorderError(null);
                                        setReordering(true);
                                        try {
                                            const dayIds = dayItems.map((i) => i.id);
                                            [dayIds[index - 1], dayIds[index]] = [dayIds[index], dayIds[index - 1]];
                                            const next = [...plan.items];
                                            const orderedDay = dayIds.map((id) => next.find((i) => i.id === id)!).filter(Boolean);
                                            const others = next.filter((i) => (i.day_index || 1) !== activeDay);
                                            const merged = [...others, ...orderedDay].sort((a, b) => a.position - b.position);
                                            await reorderWorkoutPlanItems(plan.id, merged.map((i) => i.id), supabase);
                                            setPlan({ ...plan, items: merged });
                                        } catch (e) {
                                            setReorderError(e instanceof Error ? e.message : 'Failed to reorder');
                                        } finally {
                                            setReordering(false);
                                        }
                                    }}
                                    onReorderDown={async () => {
                                        setReorderError(null);
                                        setReordering(true);
                                        try {
                                            const dayIds = dayItems.map((i) => i.id);
                                            [dayIds[index], dayIds[index + 1]] = [dayIds[index + 1], dayIds[index]];
                                            const next = [...plan.items];
                                            const orderedDay = dayIds.map((id) => next.find((i) => i.id === id)!).filter(Boolean);
                                            const others = next.filter((i) => (i.day_index || 1) !== activeDay);
                                            const merged = [...others, ...orderedDay].sort((a, b) => a.position - b.position);
                                            await reorderWorkoutPlanItems(plan.id, merged.map((i) => i.id), supabase);
                                            setPlan({ ...plan, items: merged });
                                        } catch (e) {
                                            setReorderError(e instanceof Error ? e.message : 'Failed to reorder');
                                        } finally {
                                            setReordering(false);
                                        }
                                    }}
                                    editingItemId={editingItemId}
                                    editItemValues={editItemValues}
                                    savingItemId={savingItemId}
                                    itemSaveError={itemSaveError}
                                    removingItemId={removingItemId}
                                    onEdit={() => {
                                        setEditingItemId(item.id);
                                        setEditItemValues({
                                            sets: String(item.sets),
                                            rep_range: item.rep_range,
                                            rest_seconds: String(item.rest_seconds),
                                            note: item.note ?? '',
                                        });
                                        setItemSaveError(null);
                                    }}
                                    onCancelEdit={() => {
                                        setEditingItemId(null);
                                        setItemSaveError(null);
                                    }}
                                    onSaveEdit={async () => {
                                        setSavingItemId(item.id);
                                        setItemSaveError(null);
                                        try {
                                            const sets = parseInt(editItemValues.sets, 10);
                                            const restSeconds = parseInt(editItemValues.rest_seconds, 10);
                                            if (Number.isNaN(sets) || sets < 1) {
                                                setItemSaveError('Sets must be at least 1');
                                                return;
                                            }
                                            if (Number.isNaN(restSeconds) || restSeconds < 0) {
                                                setItemSaveError('Rest seconds cannot be negative');
                                                return;
                                            }
                                            const trimmedRepRange = editItemValues.rep_range.trim();
                                            if (!trimmedRepRange) {
                                                setItemSaveError('Rep range is required');
                                                return;
                                            }
                                            const updated = await updateWorkoutPlanItem(
                                                item.id,
                                                {
                                                    sets,
                                                    rep_range: trimmedRepRange,
                                                    rest_seconds: restSeconds,
                                                    note: editItemValues.note.trim() || null,
                                                },
                                                supabase
                                            );
                                            setPlan((p) => ({
                                                ...p!,
                                                items: p!.items.map((i) => (i.id === item.id ? updated : i)),
                                            }));
                                            setEditingItemId(null);
                                        } catch (e) {
                                            setItemSaveError(e instanceof Error ? e.message : 'Failed to save');
                                        } finally {
                                            setSavingItemId(null);
                                        }
                                    }}
                                    onEditValuesChange={setEditItemValues}
                                    onRemove={async () => {
                                        if (!window.confirm('Remove this exercise from the plan?')) return;
                                        setRemovingItemId(item.id);
                                        setItemSaveError(null);
                                        try {
                                            await removeWorkoutPlanItem(item.id, supabase);
                                            setPlan((p) => ({
                                                ...p!,
                                                items: p!.items.filter((i) => i.id !== item.id),
                                            }));
                                            setEditingItemId((id) => (id === item.id ? null : id));
                                        } catch (e) {
                                            setItemSaveError(e instanceof Error ? e.message : 'Failed to remove');
                                        } finally {
                                            setRemovingItemId(null);
                                        }
                                    }}
                                    onSwap={async () => {
                                        setSwappingItemId(item.id);
                                        setItemSaveError(null);
                                        try {
                                            const current = catalog.find((c) => c.slug === item.exercise_slug);
                                            const replacement = catalog.find((c) =>
                                                c.slug !== item.exercise_slug &&
                                                c.primary_muscle_group?.slug === current?.primary_muscle_group?.slug
                                            );
                                            if (!replacement) {
                                                setItemSaveError('No swap candidate found for this muscle group.');
                                                return;
                                            }
                                            const updated = await updateWorkoutPlanItemExercise(item.id, replacement.slug, supabase);
                                            setPlan((p) => ({
                                                ...p!,
                                                items: p!.items.map((i) => (i.id === item.id ? updated : i)),
                                            }));
                                            setExerciseNames((prev) => ({ ...prev, [updated.exercise_slug]: replacement.name }));
                                        } catch (e) {
                                            setItemSaveError(e instanceof Error ? e.message : 'Failed to swap');
                                        } finally {
                                            setSwappingItemId(null);
                                        }
                                    }}
                                    swapping={swappingItemId === item.id}
                                />
                            </li>
                        ))}
                    </ol>
                )}
                <div className="mt-4 space-y-2">
                    {!addExerciseOpen ? (
                        <button
                            type="button"
                            onClick={() => {
                                setAddExerciseOpen(true);
                                setAddExerciseSearch('');
                                setAddExerciseSelected(null);
                                setAddExerciseSets('3');
                                setAddExerciseReps('8–12');
                                setAddExerciseRest('60');
                                setAddExerciseNote('');
                                setAddExerciseError(null);
                            }}
                            className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            + Add exercise
                        </button>
                    ) : (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Add exercise
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddExerciseOpen(false);
                                        setAddExerciseSelected(null);
                                        setAddExerciseError(null);
                                    }}
                                    className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={addExerciseSearch}
                                    onChange={(e) => setAddExerciseSearch(e.target.value)}
                                    placeholder="Search exercises…"
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {addExerciseFiltered.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        No exercises match.
                                    </p>
                                ) : (
                                    addExerciseFiltered.slice(0, 15).map((ex) => (
                                        <button
                                            key={ex.id}
                                            type="button"
                                            onClick={() => setAddExerciseSelected(ex)}
                                            className={`block w-full rounded border px-2 py-1 text-left text-[11px] ${
                                                addExerciseSelected?.slug === ex.slug
                                                    ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-900/30'
                                                    : 'border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {ex.name}
                                        </button>
                                    ))
                                )}
                            </div>
                            {addExerciseSelected && (
                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                                    <label className="flex items-center gap-1 text-[11px]">
                                        Sets:
                                        <input
                                            type="number"
                                            min={1}
                                            value={addExerciseSets}
                                            onChange={(e) => setAddExerciseSets(e.target.value)}
                                            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        />
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px]">
                                        Reps:
                                        <input
                                            type="text"
                                            value={addExerciseReps}
                                            onChange={(e) => setAddExerciseReps(e.target.value)}
                                            placeholder="8–12"
                                            className="w-16 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        />
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px]">
                                        Rest (sec):
                                        <input
                                            type="number"
                                            min={0}
                                            value={addExerciseRest}
                                            onChange={(e) => setAddExerciseRest(e.target.value)}
                                            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-0.5 text-[11px] min-w-[140px]">
                                        <span className="text-slate-500 dark:text-slate-400">Note</span>
                                        <input
                                            type="text"
                                            value={addExerciseNote}
                                            onChange={(e) => setAddExerciseNote(e.target.value)}
                                            placeholder="Optional…"
                                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        disabled={addExerciseSaving}
                                        onClick={async () => {
                                            setAddExerciseSaving(true);
                                            setAddExerciseError(null);
                                            try {
                                                const sets = parseInt(addExerciseSets, 10);
                                                const restSeconds = parseInt(addExerciseRest, 10);
                                                if (Number.isNaN(sets) || sets < 1) {
                                                    setAddExerciseError('Sets must be at least 1');
                                                    return;
                                                }
                                                if (Number.isNaN(restSeconds) || restSeconds < 0) {
                                                    setAddExerciseError('Rest seconds cannot be negative');
                                                    return;
                                                }
                                                const repRange = addExerciseReps.trim() || '8–12';
                                                const newItem = await addWorkoutPlanItem(
                                                    plan.id,
                                                    {
                                                        exerciseSlug: addExerciseSelected.slug,
                                                        day_index: activeDay,
                                                        sets,
                                                        rep_range: repRange,
                                                        rest_seconds: restSeconds,
                                                        note: addExerciseNote.trim() || null,
                                                    },
                                                    supabase
                                                );
                                                setPlan((p) => ({ ...p!, items: [...p!.items, newItem] }));
                                                setExerciseNames((prev) => ({
                                                    ...prev,
                                                    [newItem.exercise_slug]: addExerciseSelected.name,
                                                }));
                                                setAddExerciseOpen(false);
                                                setAddExerciseSelected(null);
                                            } catch (e) {
                                                setAddExerciseError(
                                                    e instanceof Error ? e.message : 'Failed to add exercise'
                                                );
                                            } finally {
                                                setAddExerciseSaving(false);
                                            }
                                        }}
                                        className="rounded border border-amber-500 bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-black hover:bg-amber-400 disabled:opacity-60 dark:bg-amber-400 dark:text-black"
                                    >
                                        {addExerciseSaving ? 'Adding…' : 'Save'}
                                    </button>
                                </div>
                            )}
                            {addExerciseError && (
                                <p className="text-[11px] text-red-600 dark:text-red-400">{addExerciseError}</p>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

