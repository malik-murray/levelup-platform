import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export type FitnessSexIdentity =
    | 'male'
    | 'female'
    | 'non_binary'
    | 'trans_male'
    | 'trans_female'
    | 'genderqueer'
    | 'agender'
    | 'intersex'
    | 'prefer_not_to_say'
    | 'self_describe';

export type FitnessTrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
    | 'fat_loss'
    | 'muscle_gain'
    | 'strength'
    | 'general_fitness'
    | 'better_cardio'
    | 'muscle_endurance';

export type FitnessEquipmentAccess =
    | 'bodyweight'
    | 'dumbbells'
    | 'barbell'
    | 'machines'
    | 'resistance_bands'
    | 'kettlebells'
    | 'pull_up_bar'
    | 'cardio_machines'
    | 'full_gym'
    | 'other';

export type FitnessTrainingStyle =
    | 'balanced'
    | 'strength_focused'
    | 'hypertrophy_focused'
    | 'cardio_focused'
    | 'circuit'
    | 'minimalist';

export type FitnessUserProfile = {
    id: string;
    user_id: string;
    sex_identity: FitnessSexIdentity;
    sex_identity_custom: string | null;
    age: number;
    training_level: FitnessTrainingLevel;
    goals: FitnessGoal[];
    days_per_week: number;
    training_weekdays: number[];
    session_duration_minutes: number;
    equipment_access: FitnessEquipmentAccess[];
    injuries_limitations: string | null;
    preferred_training_style: FitnessTrainingStyle | null;
    is_onboarding_complete: boolean;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type UpsertFitnessUserProfileInput = {
    sex_identity: FitnessSexIdentity;
    sex_identity_custom?: string | null;
    age: number;
    training_level: FitnessTrainingLevel;
    goals: FitnessGoal[];
    training_weekdays: number[];
    session_duration_minutes: number;
    equipment_access: FitnessEquipmentAccess[];
    injuries_limitations?: string | null;
    preferred_training_style?: FitnessTrainingStyle | null;
};

export async function getFitnessUserProfileForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<FitnessUserProfile | null> {
    if (!userId?.trim()) return null;
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('getFitnessUserProfileForUser:', error);
        throw error;
    }
    return (data ?? null) as FitnessUserProfile | null;
}

export async function upsertFitnessUserProfileForUser(
    userId: string,
    input: UpsertFitnessUserProfileInput,
    supabase?: SupabaseClient
): Promise<FitnessUserProfile> {
    const client = getClient(supabase);

    const payload = {
        user_id: userId,
        sex_identity: input.sex_identity,
        sex_identity_custom:
            input.sex_identity === 'self_describe'
                ? (input.sex_identity_custom ?? '').trim() || null
                : null,
        age: input.age,
        training_level: input.training_level,
        goals: input.goals,
        days_per_week: input.training_weekdays.length,
        training_weekdays: input.training_weekdays,
        session_duration_minutes: input.session_duration_minutes,
        equipment_access: input.equipment_access,
        injuries_limitations: input.injuries_limitations?.trim() || null,
        preferred_training_style: input.preferred_training_style ?? null,
        is_onboarding_complete: true,
        completed_at: new Date().toISOString(),
    };

    const { data, error } = await client
        .from('fitness_user_profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

    if (error) {
        console.error('upsertFitnessUserProfileForUser:', error);
        throw error;
    }
    return data as FitnessUserProfile;
}
