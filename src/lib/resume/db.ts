// Database utilities for Resume Generator App
import { createClient } from '@supabase/supabase-js';
import type {
  UserProfileDefaults,
  Template,
  UserSettings,
  Credits,
  Generation,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side Supabase client (for API routes)
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// User Profile Defaults
export async function getUserProfileDefaults(userId: string): Promise<UserProfileDefaults | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profile_defaults')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user profile defaults:', error);
    throw error;
  }

  return data || null;
}

export async function upsertUserProfileDefaults(
  userId: string,
  profile: Partial<UserProfileDefaults>
): Promise<UserProfileDefaults> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profile_defaults')
    .upsert(
      {
        user_id: userId,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting user profile defaults:', error);
    throw error;
  }

  return data;
}

// Templates
export async function getTemplates(type?: 'resume' | 'cover_letter'): Promise<Template[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from('templates').select('*').order('is_default', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }

  return data || [];
}

export async function getTemplate(templateId: string): Promise<Template | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    console.error('Error fetching template:', error);
    throw error;
  }

  return data;
}

// User Settings
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user settings:', error);
    throw error;
  }

  return data || null;
}

export async function upsertUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting user settings:', error);
    throw error;
  }

  return data;
}

// Credits
export async function getUserCredits(userId: string): Promise<Credits | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user credits:', error);
    throw error;
  }

  return data || null;
}

export async function ensureUserHasCredits(
  userId: string,
  creditsNeeded: number = 1
): Promise<boolean> {
  const credits = await getUserCredits(userId);
  if (!credits) {
    return false;
  }
  const remaining = credits.total_credits - credits.used_credits;
  // Allow unlimited credits for testing (999999 or more)
  if (credits.total_credits >= 999999) {
    return true;
  }
  return remaining >= creditsNeeded;
}

export async function consumeCredits(userId: string, amount: number = 1): Promise<void> {
  const credits = await getUserCredits(userId);
  if (!credits) {
    throw new Error('User credits not found');
  }

  // Don't consume credits if user has unlimited (999999 or more)
  if (credits.total_credits >= 999999) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('increment_used_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    // Fallback: manual update if RPC doesn't exist
    const { error: updateError } = await supabase
      .from('credits')
      .update({
        used_credits: credits.used_credits + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error consuming credits:', updateError);
      throw updateError;
    }
  }
}

export async function addCredits(userId: string, amount: number): Promise<Credits> {
  const supabase = getSupabaseClient();
  const credits = await getUserCredits(userId);

  if (credits) {
    const { data, error } = await supabase
      .from('credits')
      .update({
        total_credits: credits.total_credits + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error adding credits:', error);
      throw error;
    }

    return data;
  } else {
    // Create new credits record
    const { data, error } = await supabase
      .from('credits')
      .insert({
        user_id: userId,
        total_credits: amount,
        used_credits: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating credits:', error);
      throw error;
    }

    return data;
  }
}

// Generations (Archive)
export async function createGeneration(generation: Omit<Generation, 'id' | 'created_at'>): Promise<Generation> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generations')
    .insert(generation)
    .select()
    .single();

  if (error) {
    console.error('Error creating generation:', error);
    throw error;
  }

  return data;
}

export async function getGenerations(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Generation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching generations:', error);
    throw error;
  }

  return data || [];
}

export async function getGeneration(generationId: string, userId: string): Promise<Generation | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', generationId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching generation:', error);
    throw error;
  }

  return data;
}

export async function updateGeneration(
  generationId: string,
  userId: string,
  updates: Partial<Generation>
): Promise<Generation> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('generations')
    .update(updates)
    .eq('id', generationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating generation:', error);
    throw error;
  }

  return data;
}

