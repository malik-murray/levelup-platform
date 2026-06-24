import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getTrainingConsistencyForUser, type TrainingConsistency } from './workoutSessions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export type FitnessDailyMetrics = {
    weight_kg: number | null;
    steps: number | null;
    water_ml: number | null;
    sleep_hours: number | null;
};

export type FitnessDailyNutrition = {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    meal_count: number;
};

export type FitnessTodaySnapshot = {
    date: string;
    metrics: FitnessDailyMetrics | null;
    nutrition: FitnessDailyNutrition;
    streak: TrainingConsistency;
};

function todayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

export async function getFitnessTodaySnapshot(
    userId: string,
    supabase?: SupabaseClient,
    date?: string
): Promise<FitnessTodaySnapshot> {
    const client = getClient(supabase);
    const dateStr = date ?? todayDateString();

    const [metricsResult, mealsResult, streak] = await Promise.all([
        client
            .from('fitness_metrics')
            .select('weight_kg, steps, water_ml, sleep_hours')
            .eq('user_id', userId)
            .eq('date', dateStr)
            .maybeSingle(),
        client
            .from('fitness_meals')
            .select('calories, protein_g, carbs_g, fat_g')
            .eq('user_id', userId)
            .eq('date', dateStr),
        getTrainingConsistencyForUser(userId, client),
    ]);

    if (metricsResult.error) {
        console.error('getFitnessTodaySnapshot (metrics):', metricsResult.error);
        throw metricsResult.error;
    }
    if (mealsResult.error) {
        console.error('getFitnessTodaySnapshot (meals):', mealsResult.error);
        throw mealsResult.error;
    }

    const meals = mealsResult.data ?? [];
    const nutrition = meals.reduce<FitnessDailyNutrition>(
        (acc, meal) => ({
            calories: acc.calories + (meal.calories ?? 0),
            protein_g: acc.protein_g + Number(meal.protein_g ?? 0),
            carbs_g: acc.carbs_g + Number(meal.carbs_g ?? 0),
            fat_g: acc.fat_g + Number(meal.fat_g ?? 0),
            meal_count: acc.meal_count + 1,
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meal_count: 0 }
    );

    return {
        date: dateStr,
        metrics: metricsResult.data
            ? {
                  weight_kg: metricsResult.data.weight_kg,
                  steps: metricsResult.data.steps,
                  water_ml: metricsResult.data.water_ml,
                  sleep_hours: metricsResult.data.sleep_hours,
              }
            : null,
        nutrition,
        streak,
    };
}
