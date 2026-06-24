'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WorkoutSessionItemWithSetLogs, WorkoutSetLog } from '@/lib/fitness/workoutSessions';
import { upsertSetLog } from '@/lib/fitness/workoutSessions';
import { supabase } from '@auth/supabaseClient';

type SetEdit = {
    reps: string;
    weight_kg: string;
    rpe: string;
    notes: string;
    saving?: boolean;
    saveError?: string;
};

type ExerciseSetLoggerProps = {
    item: WorkoutSessionItemWithSetLogs;
    canEdit: boolean;
    onItemUpdated: (item: WorkoutSessionItemWithSetLogs) => void;
    onSetCompleted?: () => void;
};

function setLogToEdit(log: WorkoutSetLog | undefined): SetEdit {
    return {
        reps: log?.reps != null ? String(log.reps) : '',
        weight_kg: log?.weight_kg != null ? String(log.weight_kg) : '',
        rpe: log?.rpe != null ? String(log.rpe) : '',
        notes: log?.notes ?? '',
    };
}

function parseOptionalNumber(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
}

export default function ExerciseSetLogger({
    item,
    canEdit,
    onItemUpdated,
    onSetCompleted,
}: ExerciseSetLoggerProps) {
    const initialSetCount = Math.max(item.target_sets, item.set_logs.length, 1);
    const [extraSets, setExtraSets] = useState(
        Math.max(0, item.set_logs.length - item.target_sets)
    );

    const setNumbers = useMemo(
        () => Array.from({ length: initialSetCount + extraSets }, (_, i) => i + 1),
        [initialSetCount, extraSets]
    );

    const [edits, setEdits] = useState<Record<number, SetEdit>>(() => {
        const initial: Record<number, SetEdit> = {};
        for (const setNumber of Array.from({ length: initialSetCount }, (_, i) => i + 1)) {
            const log = item.set_logs.find((entry) => entry.set_number === setNumber);
            initial[setNumber] = setLogToEdit(log);
        }
        return initial;
    });

    const logsBySet = useMemo(() => {
        const map = new Map<number, WorkoutSetLog>();
        for (const log of item.set_logs) {
            map.set(log.set_number, log);
        }
        return map;
    }, [item.set_logs]);

    const getEdit = useCallback(
        (setNumber: number): SetEdit => edits[setNumber] ?? setLogToEdit(logsBySet.get(setNumber)),
        [edits, logsBySet]
    );

    const saveSet = async (setNumber: number, markComplete = false) => {
        const edit = getEdit(setNumber);
        setEdits((prev) => ({
            ...prev,
            [setNumber]: { ...edit, saving: true, saveError: undefined },
        }));

        try {
            const reps = parseOptionalNumber(edit.reps);
            const weight_kg = parseOptionalNumber(edit.weight_kg);
            const rpe = parseOptionalNumber(edit.rpe);
            const hasData =
                reps != null ||
                weight_kg != null ||
                rpe != null ||
                edit.notes.trim().length > 0;

            const result = await upsertSetLog(
                item.id,
                setNumber,
                {
                    reps,
                    weight_kg,
                    rpe,
                    notes: edit.notes.trim() || null,
                    completed_at: markComplete || hasData ? new Date().toISOString() : null,
                },
                supabase
            );
            onItemUpdated(result.item);
            setEdits((prev) => ({
                ...prev,
                [setNumber]: {
                    reps: result.setLog.reps != null ? String(result.setLog.reps) : '',
                    weight_kg:
                        result.setLog.weight_kg != null ? String(result.setLog.weight_kg) : '',
                    rpe: result.setLog.rpe != null ? String(result.setLog.rpe) : '',
                    notes: result.setLog.notes ?? '',
                    saving: false,
                },
            }));
            if (markComplete) onSetCompleted?.();
        } catch (e) {
            setEdits((prev) => ({
                ...prev,
                [setNumber]: {
                    ...edit,
                    saving: false,
                    saveError: e instanceof Error ? e.message : 'Failed to save set',
                },
            }));
        }
    };

    if (!canEdit) {
        if (item.set_logs.length === 0) {
            return (
                <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {item.actual_sets_completed != null && (
                        <span>
                            <span className="font-semibold">Sets completed:</span>{' '}
                            {item.actual_sets_completed}
                        </span>
                    )}
                    {item.actual_avg_reps_per_set != null && (
                        <span className="ml-2">
                            <span className="font-semibold">Avg reps:</span>{' '}
                            {item.actual_avg_reps_per_set}
                        </span>
                    )}
                    {!item.actual_sets_completed && !item.actual_avg_reps_per_set && (
                        <p>No set data recorded.</p>
                    )}
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-[11px]">
                    <thead>
                        <tr className="text-slate-500 dark:text-slate-400">
                            <th className="pb-1 pr-2 font-medium">Set</th>
                            <th className="pb-1 pr-2 font-medium">Reps</th>
                            <th className="pb-1 pr-2 font-medium">kg</th>
                            <th className="pb-1 pr-2 font-medium">RPE</th>
                            <th className="pb-1 font-medium">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {item.set_logs.map((log) => (
                            <tr key={log.id} className="text-slate-700 dark:text-slate-200">
                                <td className="py-0.5 pr-2">{log.set_number}</td>
                                <td className="py-0.5 pr-2">{log.reps ?? '—'}</td>
                                <td className="py-0.5 pr-2">{log.weight_kg ?? '—'}</td>
                                <td className="py-0.5 pr-2">{log.rpe ?? '—'}</td>
                                <td className="py-0.5">{log.notes ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-[11px]">
                    <thead>
                        <tr className="text-slate-500 dark:text-slate-400">
                            <th className="pb-1 pr-1 font-medium">Set</th>
                            <th className="pb-1 pr-1 font-medium">Reps</th>
                            <th className="pb-1 pr-1 font-medium">kg</th>
                            <th className="pb-1 pr-1 font-medium">RPE</th>
                            <th className="pb-1 pr-1 font-medium">Notes</th>
                            <th className="pb-1 font-medium" />
                        </tr>
                    </thead>
                    <tbody>
                        {setNumbers.map((setNumber) => {
                            const edit = getEdit(setNumber);
                            const isTargetSet = setNumber <= item.target_sets;
                            return (
                                <tr key={setNumber}>
                                    <td className="py-1 pr-1 align-top">
                                        <span
                                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 font-semibold ${
                                                isTargetSet
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                            }`}
                                        >
                                            {setNumber}
                                        </span>
                                    </td>
                                    <td className="py-1 pr-1 align-top">
                                        <input
                                            type="number"
                                            min={0}
                                            value={edit.reps}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [setNumber]: {
                                                        ...getEdit(setNumber),
                                                        reps: e.target.value,
                                                        saveError: undefined,
                                                    },
                                                }))
                                            }
                                            className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </td>
                                    <td className="py-1 pr-1 align-top">
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.5}
                                            value={edit.weight_kg}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [setNumber]: {
                                                        ...getEdit(setNumber),
                                                        weight_kg: e.target.value,
                                                        saveError: undefined,
                                                    },
                                                }))
                                            }
                                            className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </td>
                                    <td className="py-1 pr-1 align-top">
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            step={0.5}
                                            value={edit.rpe}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [setNumber]: {
                                                        ...getEdit(setNumber),
                                                        rpe: e.target.value,
                                                        saveError: undefined,
                                                    },
                                                }))
                                            }
                                            className="w-12 rounded border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </td>
                                    <td className="py-1 pr-1 align-top">
                                        <input
                                            type="text"
                                            value={edit.notes}
                                            placeholder="pain, form…"
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [setNumber]: {
                                                        ...getEdit(setNumber),
                                                        notes: e.target.value,
                                                        saveError: undefined,
                                                    },
                                                }))
                                            }
                                            className="w-24 rounded border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </td>
                                    <td className="py-1 align-top">
                                        <button
                                            type="button"
                                            disabled={!!edit.saving}
                                            onClick={() => void saveSet(setNumber, true)}
                                            className="whitespace-nowrap rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                                        >
                                            {edit.saving ? '…' : 'Done'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setExtraSets((prev) => prev + 1)}
                    className="rounded border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    + Add set
                </button>
            </div>
            {setNumbers.some((n) => getEdit(n).saveError) && (
                <p className="text-[11px] text-red-500 dark:text-red-400">
                    {setNumbers.map((n) => getEdit(n).saveError).find(Boolean)}
                </p>
            )}
        </div>
    );
}
