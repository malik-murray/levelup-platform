'use client';

import { useMemo, useState } from 'react';
import type { UpsertFitnessUserProfileInput } from '@/lib/fitness/profile';
import {
    COACHING_TONE_OPTIONS,
    DEFAULT_PROFILE_FORM_VALUES,
    EQUIPMENT_OPTIONS,
    GOAL_OPTIONS,
    MOTIVATION_STYLE_OPTIONS,
    SEX_OPTIONS,
    TRAINING_STYLE_OPTIONS,
    WEEKDAY_OPTIONS,
    toggleValue,
    type FitnessProfileFormValues,
} from '@/lib/fitness/profileFormOptions';

type Props = {
    initialValues?: Partial<FitnessProfileFormValues>;
    onSubmit: (input: UpsertFitnessUserProfileInput) => Promise<void>;
    submitLabel: string;
    title?: string;
    description?: string;
};

function mergeInitialValues(initial?: Partial<FitnessProfileFormValues>): FitnessProfileFormValues {
    return { ...DEFAULT_PROFILE_FORM_VALUES, ...initial };
}

export default function FitnessProfileForm({
    initialValues,
    onSubmit,
    submitLabel,
    title,
    description,
}: Props) {
    const [values, setValues] = useState<FitnessProfileFormValues>(() => mergeInitialValues(initialValues));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        const ageNum = Number(values.age);
        const durationNum = Number(values.sessionDuration);
        if (
            Number.isNaN(ageNum) ||
            Number.isNaN(durationNum) ||
            ageNum < 13 ||
            ageNum > 100 ||
            durationNum < 15 ||
            durationNum > 180
        ) {
            return false;
        }
        if (values.trainingWeekdays.length === 0 || values.trainingWeekdays.length > 7) return false;
        if (values.goals.length === 0) return false;
        if (values.equipment.length === 0) return false;
        if (values.sexIdentity === 'self_describe' && values.sexIdentityCustom.trim().length === 0) return false;
        return true;
    }, [values]);

    const set = <K extends keyof FitnessProfileFormValues>(key: K, value: FitnessProfileFormValues[K]) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        setError(null);
        try {
            await onSubmit({
                sex_identity: values.sexIdentity,
                sex_identity_custom: values.sexIdentityCustom || null,
                age: Number(values.age),
                training_level: values.trainingLevel,
                goals: values.goals,
                training_weekdays: [...values.trainingWeekdays].sort((a, b) => a - b),
                session_duration_minutes: Number(values.sessionDuration),
                equipment_access: values.equipment,
                injuries_limitations: values.injuriesLimitations || null,
                preferred_training_style: values.trainingStyle || null,
                coaching_tone: values.coachingTone,
                motivation_style: values.motivationStyle,
                session_constraints: {
                    time_pressure_mode: values.timePressureMode,
                },
                injury_confidence_map: {
                    knee: Number(values.kneeConfidence),
                    back: Number(values.backConfidence),
                    shoulder: Number(values.shoulderConfidence),
                },
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 md:p-6">
            {title && <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>}
            {description && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
            )}

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Sex identity</span>
                        <select
                            value={values.sexIdentity}
                            onChange={(e) => set('sexIdentity', e.target.value as FitnessProfileFormValues['sexIdentity'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            {SEX_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {values.sexIdentity === 'self_describe' && (
                        <label className="text-sm">
                            <span className="text-slate-700 dark:text-slate-300">How do you describe your sex identity?</span>
                            <input
                                value={values.sexIdentityCustom}
                                onChange={(e) => set('sexIdentityCustom', e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                placeholder="Enter your identity"
                            />
                        </label>
                    )}

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Age</span>
                        <input
                            type="number"
                            min={13}
                            max={100}
                            value={values.age}
                            onChange={(e) => set('age', e.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Training level</span>
                        <select
                            value={values.trainingLevel}
                            onChange={(e) => set('trainingLevel', e.target.value as FitnessProfileFormValues['trainingLevel'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>
                    </label>

                    <div className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Training days</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((day) => {
                                const active = values.trainingWeekdays.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() =>
                                            set('trainingWeekdays', (() => {
                                                const next = toggleValue(values.trainingWeekdays, day.value);
                                                return next.length === 0 ? values.trainingWeekdays : next;
                                            })())
                                        }
                                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                                            active
                                                ? 'bg-amber-500 text-black'
                                                : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Selected: {values.trainingWeekdays.length} day{values.trainingWeekdays.length !== 1 ? 's' : ''} per week
                        </p>
                    </div>

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Session duration target (minutes)</span>
                        <input
                            type="number"
                            min={15}
                            max={180}
                            step={5}
                            value={values.sessionDuration}
                            onChange={(e) => set('sessionDuration', e.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>

                    <label className="text-sm md:col-span-2">
                        <span className="text-slate-700 dark:text-slate-300">Preferred training style (optional)</span>
                        <select
                            value={values.trainingStyle}
                            onChange={(e) => set('trainingStyle', e.target.value as FitnessProfileFormValues['trainingStyle'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="">No preference</option>
                            {TRAINING_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Coaching tone</span>
                        <select
                            value={values.coachingTone}
                            onChange={(e) => set('coachingTone', e.target.value as FitnessProfileFormValues['coachingTone'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            {COACHING_TONE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Motivation style</span>
                        <select
                            value={values.motivationStyle}
                            onChange={(e) => set('motivationStyle', e.target.value as FitnessProfileFormValues['motivationStyle'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            {MOTIVATION_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm">
                        <span className="text-slate-700 dark:text-slate-300">Session pacing</span>
                        <select
                            value={values.timePressureMode}
                            onChange={(e) => set('timePressureMode', e.target.value as FitnessProfileFormValues['timePressureMode'])}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="normal">Normal pace</option>
                            <option value="compressed">Compressed (time-efficient)</option>
                        </select>
                    </label>
                </div>

                <fieldset>
                    <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Goals (choose one or more)</legend>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {GOAL_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={values.goals.includes(opt.value)}
                                    onChange={() => set('goals', toggleValue(values.goals, opt.value))}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Equipment access (choose all that apply)</legend>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {EQUIPMENT_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={values.equipment.includes(opt.value)}
                                    onChange={() => set('equipment', toggleValue(values.equipment, opt.value))}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="block text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Injuries or limitations (optional)</span>
                    <textarea
                        value={values.injuriesLimitations}
                        onChange={(e) => set('injuriesLimitations', e.target.value)}
                        rows={3}
                        placeholder="Example: Knee pain on deep squats, avoid overhead pressing."
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                </label>

                <fieldset className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                    <legend className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">Movement confidence (1-5)</legend>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="text-xs text-slate-700 dark:text-slate-300">
                            Knee
                            <input type="number" min={1} max={5} value={values.kneeConfidence} onChange={(e) => set('kneeConfidence', e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                        </label>
                        <label className="text-xs text-slate-700 dark:text-slate-300">
                            Back
                            <input type="number" min={1} max={5} value={values.backConfidence} onChange={(e) => set('backConfidence', e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                        </label>
                        <label className="text-xs text-slate-700 dark:text-slate-300">
                            Shoulder
                            <input type="number" min={1} max={5} value={values.shoulderConfidence} onChange={(e) => set('shoulderConfidence', e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                        </label>
                    </div>
                </fieldset>

                {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

                <button
                    type="submit"
                    disabled={!canSubmit || saving}
                    className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-400 dark:hover:bg-amber-300"
                >
                    {saving ? 'Saving...' : submitLabel}
                </button>
            </form>
        </section>
    );
}
