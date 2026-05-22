'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import {
    upsertFitnessUserProfileForUser,
    type FitnessCoachingTone,
    type FitnessEquipmentAccess,
    type FitnessGoal,
    type FitnessMotivationStyle,
    type FitnessSexIdentity,
    type FitnessTrainingLevel,
    type FitnessTrainingStyle,
} from '@/lib/fitness/profile';

type Props = {
    onCompleted: () => void;
};

const SEX_OPTIONS: { value: FitnessSexIdentity; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'trans_male', label: 'Trans male' },
    { value: 'trans_female', label: 'Trans female' },
    { value: 'genderqueer', label: 'Genderqueer' },
    { value: 'agender', label: 'Agender' },
    { value: 'intersex', label: 'Intersex' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    { value: 'self_describe', label: 'Self-describe' },
];

const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
    { value: 'fat_loss', label: 'Fat loss' },
    { value: 'muscle_gain', label: 'Muscle gain' },
    { value: 'strength', label: 'Strength' },
    { value: 'general_fitness', label: 'General fitness' },
    { value: 'better_cardio', label: 'Better cardio' },
    { value: 'muscle_endurance', label: 'Muscle endurance' },
];

const EQUIPMENT_OPTIONS: { value: FitnessEquipmentAccess; label: string }[] = [
    { value: 'bodyweight', label: 'Bodyweight only' },
    { value: 'dumbbells', label: 'Dumbbells' },
    { value: 'barbell', label: 'Barbell' },
    { value: 'machines', label: 'Gym machines' },
    { value: 'resistance_bands', label: 'Resistance bands' },
    { value: 'kettlebells', label: 'Kettlebells' },
    { value: 'pull_up_bar', label: 'Pull-up bar' },
    { value: 'cardio_machines', label: 'Cardio machines' },
    { value: 'full_gym', label: 'Full gym access' },
    { value: 'other', label: 'Other' },
];

const TRAINING_STYLE_OPTIONS: { value: FitnessTrainingStyle; label: string }[] = [
    { value: 'balanced', label: 'Balanced mix' },
    { value: 'strength_focused', label: 'Strength-focused' },
    { value: 'hypertrophy_focused', label: 'Muscle-building focused' },
    { value: 'cardio_focused', label: 'Cardio-focused' },
    { value: 'circuit', label: 'Circuit / faster pace' },
    { value: 'minimalist', label: 'Minimalist / efficient sessions' },
];

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 0, label: 'Sun' },
];

const COACHING_TONE_OPTIONS: { value: FitnessCoachingTone; label: string }[] = [
    { value: 'encouraging', label: 'Encouraging' },
    { value: 'tough_love', label: 'Tough love' },
    { value: 'neutral', label: 'Neutral' },
];

const MOTIVATION_STYLE_OPTIONS: { value: FitnessMotivationStyle; label: string }[] = [
    { value: 'short_cues', label: 'Short cues' },
    { value: 'detailed_rationale', label: 'Detailed rationale' },
];

function toggleValue<T extends string | number>(arr: T[], value: T): T[] {
    if (arr.includes(value)) return arr.filter((v) => v !== value);
    return [...arr, value];
}

export default function FitnessOnboardingWizard({ onCompleted }: Props) {
    const [sexIdentity, setSexIdentity] = useState<FitnessSexIdentity>('prefer_not_to_say');
    const [sexIdentityCustom, setSexIdentityCustom] = useState('');
    const [age, setAge] = useState('30');
    const [trainingLevel, setTrainingLevel] = useState<FitnessTrainingLevel>('beginner');
    const [goals, setGoals] = useState<FitnessGoal[]>(['general_fitness']);
    const [trainingWeekdays, setTrainingWeekdays] = useState<number[]>([1, 3, 5]);
    const [sessionDuration, setSessionDuration] = useState('45');
    const [equipment, setEquipment] = useState<FitnessEquipmentAccess[]>(['bodyweight']);
    const [injuriesLimitations, setInjuriesLimitations] = useState('');
    const [trainingStyle, setTrainingStyle] = useState<FitnessTrainingStyle | ''>('');
    const [coachingTone, setCoachingTone] = useState<FitnessCoachingTone>('encouraging');
    const [motivationStyle, setMotivationStyle] = useState<FitnessMotivationStyle>('short_cues');
    const [timePressureMode, setTimePressureMode] = useState<'normal' | 'compressed'>('normal');
    const [kneeConfidence, setKneeConfidence] = useState('3');
    const [backConfidence, setBackConfidence] = useState('3');
    const [shoulderConfidence, setShoulderConfidence] = useState('3');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = useMemo(() => {
        const ageNum = Number(age);
        const durationNum = Number(sessionDuration);
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
        if (trainingWeekdays.length === 0 || trainingWeekdays.length > 7) return false;
        if (goals.length === 0) return false;
        if (equipment.length === 0) return false;
        if (sexIdentity === 'self_describe' && sexIdentityCustom.trim().length === 0) return false;
        return true;
    }, [age, equipment, goals, sessionDuration, sexIdentity, sexIdentityCustom, trainingWeekdays]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        setError(null);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            await upsertFitnessUserProfileForUser(
                user.id,
                {
                    sex_identity: sexIdentity,
                    sex_identity_custom: sexIdentityCustom || null,
                    age: Number(age),
                    training_level: trainingLevel,
                    goals,
                    training_weekdays: [...trainingWeekdays].sort((a, b) => a - b),
                    session_duration_minutes: Number(sessionDuration),
                    equipment_access: equipment,
                    injuries_limitations: injuriesLimitations || null,
                    preferred_training_style: trainingStyle || null,
                    coaching_tone: coachingTone,
                    motivation_style: motivationStyle,
                    session_constraints: {
                        time_pressure_mode: timePressureMode,
                    },
                    injury_confidence_map: {
                        knee: Number(kneeConfidence),
                        back: Number(backConfidence),
                        shoulder: Number(shoulderConfidence),
                    },
                },
                supabase
            );
            onCompleted();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save onboarding profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 md:p-6">
            <h2 className="text-xl font-semibold text-white">Welcome to Fitness</h2>
            <p className="mt-1 text-sm text-slate-400">
                Answer a few questions so we can tailor your training plan. You can update these later.
            </p>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="text-sm">
                        <span className="text-slate-300">Sex identity</span>
                        <select
                            value={sexIdentity}
                            onChange={(e) => setSexIdentity(e.target.value as FitnessSexIdentity)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                            {SEX_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {sexIdentity === 'self_describe' && (
                        <label className="text-sm">
                            <span className="text-slate-300">How do you describe your sex identity?</span>
                            <input
                                value={sexIdentityCustom}
                                onChange={(e) => setSexIdentityCustom(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                                placeholder="Enter your identity"
                            />
                        </label>
                    )}

                    <label className="text-sm">
                        <span className="text-slate-300">Age</span>
                        <input
                            type="number"
                            min={13}
                            max={100}
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        />
                    </label>

                    <label className="text-sm">
                        <span className="text-slate-300">Training level</span>
                        <select
                            value={trainingLevel}
                            onChange={(e) => setTrainingLevel(e.target.value as FitnessTrainingLevel)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>
                    </label>

                    <div className="text-sm">
                        <span className="text-slate-300">Training days</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((day) => {
                                const active = trainingWeekdays.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() =>
                                            setTrainingWeekdays((prev) => {
                                                const next = toggleValue(prev, day.value);
                                                return next.length === 0 ? prev : next;
                                            })
                                        }
                                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                                            active
                                                ? 'bg-amber-500 text-black'
                                                : 'border border-slate-700 bg-slate-900 text-slate-200'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            Selected: {trainingWeekdays.length} day{trainingWeekdays.length !== 1 ? 's' : ''} per week
                        </p>
                    </div>

                    <label className="text-sm">
                        <span className="text-slate-300">Session duration target (minutes)</span>
                        <input
                            type="number"
                            min={15}
                            max={180}
                            step={5}
                            value={sessionDuration}
                            onChange={(e) => setSessionDuration(e.target.value)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        />
                    </label>

                    <label className="text-sm md:col-span-2">
                        <span className="text-slate-300">Preferred training style (optional)</span>
                        <select
                            value={trainingStyle}
                            onChange={(e) => setTrainingStyle(e.target.value as FitnessTrainingStyle | '')}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
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
                        <span className="text-slate-300">Coaching tone</span>
                        <select
                            value={coachingTone}
                            onChange={(e) => setCoachingTone(e.target.value as FitnessCoachingTone)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                            {COACHING_TONE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm">
                        <span className="text-slate-300">Motivation style</span>
                        <select
                            value={motivationStyle}
                            onChange={(e) => setMotivationStyle(e.target.value as FitnessMotivationStyle)}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                            {MOTIVATION_STYLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm">
                        <span className="text-slate-300">Session pacing</span>
                        <select
                            value={timePressureMode}
                            onChange={(e) => setTimePressureMode(e.target.value as 'normal' | 'compressed')}
                            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                            <option value="normal">Normal pace</option>
                            <option value="compressed">Compressed (time-efficient)</option>
                        </select>
                    </label>
                </div>

                <fieldset>
                    <legend className="text-sm font-medium text-slate-300">Goals (choose one or more)</legend>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {GOAL_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={goals.includes(opt.value)}
                                    onChange={() => setGoals((prev) => toggleValue(prev, opt.value))}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-sm font-medium text-slate-300">Equipment access (choose all that apply)</legend>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {EQUIPMENT_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={equipment.includes(opt.value)}
                                    onChange={() => setEquipment((prev) => toggleValue(prev, opt.value))}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="block text-sm">
                    <span className="text-slate-300">Injuries or limitations (optional)</span>
                    <textarea
                        value={injuriesLimitations}
                        onChange={(e) => setInjuriesLimitations(e.target.value)}
                        rows={3}
                        placeholder="Example: Knee pain on deep squats, avoid overhead pressing."
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                </label>
                <fieldset className="rounded-md border border-slate-800 p-3">
                    <legend className="px-1 text-xs font-medium text-slate-400">Movement confidence (1-5)</legend>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="text-xs text-slate-300">
                            Knee
                            <input type="number" min={1} max={5} value={kneeConfidence} onChange={(e) => setKneeConfidence(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white" />
                        </label>
                        <label className="text-xs text-slate-300">
                            Back
                            <input type="number" min={1} max={5} value={backConfidence} onChange={(e) => setBackConfidence(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white" />
                        </label>
                        <label className="text-xs text-slate-300">
                            Shoulder
                            <input type="number" min={1} max={5} value={shoulderConfidence} onChange={(e) => setShoulderConfidence(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white" />
                        </label>
                    </div>
                </fieldset>

                {error && (
                    <p className="text-sm text-red-400">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit || saving}
                    className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? 'Saving profile...' : 'Complete onboarding'}
                </button>
            </form>
        </section>
    );
}
