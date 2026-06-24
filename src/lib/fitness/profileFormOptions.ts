import type {
    FitnessCoachingTone,
    FitnessEquipmentAccess,
    FitnessGoal,
    FitnessMotivationStyle,
    FitnessSexIdentity,
    FitnessTrainingLevel,
    FitnessTrainingStyle,
    FitnessUserProfile,
} from './profile';

export const SEX_OPTIONS: { value: FitnessSexIdentity; label: string }[] = [
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

export const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
    { value: 'fat_loss', label: 'Fat loss' },
    { value: 'muscle_gain', label: 'Muscle gain' },
    { value: 'strength', label: 'Strength' },
    { value: 'general_fitness', label: 'General fitness' },
    { value: 'better_cardio', label: 'Better cardio' },
    { value: 'muscle_endurance', label: 'Muscle endurance' },
];

export const EQUIPMENT_OPTIONS: { value: FitnessEquipmentAccess; label: string }[] = [
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

export const TRAINING_STYLE_OPTIONS: { value: FitnessTrainingStyle; label: string }[] = [
    { value: 'balanced', label: 'Balanced mix' },
    { value: 'strength_focused', label: 'Strength-focused' },
    { value: 'hypertrophy_focused', label: 'Muscle-building focused' },
    { value: 'cardio_focused', label: 'Cardio-focused' },
    { value: 'circuit', label: 'Circuit / faster pace' },
    { value: 'minimalist', label: 'Minimalist / efficient sessions' },
];

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 0, label: 'Sun' },
];

export const COACHING_TONE_OPTIONS: { value: FitnessCoachingTone; label: string }[] = [
    { value: 'encouraging', label: 'Encouraging' },
    { value: 'tough_love', label: 'Tough love' },
    { value: 'neutral', label: 'Neutral' },
];

export const MOTIVATION_STYLE_OPTIONS: { value: FitnessMotivationStyle; label: string }[] = [
    { value: 'short_cues', label: 'Short cues' },
    { value: 'detailed_rationale', label: 'Detailed rationale' },
];

export type FitnessProfileFormValues = {
    sexIdentity: FitnessSexIdentity;
    sexIdentityCustom: string;
    age: string;
    trainingLevel: FitnessTrainingLevel;
    goals: FitnessGoal[];
    trainingWeekdays: number[];
    sessionDuration: string;
    equipment: FitnessEquipmentAccess[];
    injuriesLimitations: string;
    trainingStyle: FitnessTrainingStyle | '';
    coachingTone: FitnessCoachingTone;
    motivationStyle: FitnessMotivationStyle;
    timePressureMode: 'normal' | 'compressed';
    kneeConfidence: string;
    backConfidence: string;
    shoulderConfidence: string;
};

export const DEFAULT_PROFILE_FORM_VALUES: FitnessProfileFormValues = {
    sexIdentity: 'prefer_not_to_say',
    sexIdentityCustom: '',
    age: '30',
    trainingLevel: 'beginner',
    goals: ['general_fitness'],
    trainingWeekdays: [1, 3, 5],
    sessionDuration: '45',
    equipment: ['bodyweight'],
    injuriesLimitations: '',
    trainingStyle: '',
    coachingTone: 'encouraging',
    motivationStyle: 'short_cues',
    timePressureMode: 'normal',
    kneeConfidence: '3',
    backConfidence: '3',
    shoulderConfidence: '3',
};

export function profileToFormValues(profile: FitnessUserProfile): FitnessProfileFormValues {
    const constraints = profile.session_constraints as { time_pressure_mode?: 'normal' | 'compressed' };
    const injuryMap = profile.injury_confidence_map ?? {};

    return {
        sexIdentity: profile.sex_identity,
        sexIdentityCustom: profile.sex_identity_custom ?? '',
        age: String(profile.age),
        trainingLevel: profile.training_level,
        goals: profile.goals,
        trainingWeekdays: profile.training_weekdays,
        sessionDuration: String(profile.session_duration_minutes),
        equipment: profile.equipment_access,
        injuriesLimitations: profile.injuries_limitations ?? '',
        trainingStyle: profile.preferred_training_style ?? '',
        coachingTone: profile.coaching_tone,
        motivationStyle: profile.motivation_style,
        timePressureMode: constraints.time_pressure_mode ?? 'normal',
        kneeConfidence: String(injuryMap.knee ?? 3),
        backConfidence: String(injuryMap.back ?? 3),
        shoulderConfidence: String(injuryMap.shoulder ?? 3),
    };
}

export function toggleValue<T extends string | number>(arr: T[], value: T): T[] {
    if (arr.includes(value)) return arr.filter((v) => v !== value);
    return [...arr, value];
}
