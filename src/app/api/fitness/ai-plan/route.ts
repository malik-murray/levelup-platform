import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key is not configured');
    }
    return new OpenAI({ apiKey });
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('AI request timed out')), ms)
        ),
    ]);
}

export async function POST(request: NextRequest) {
    try {
        if (process.env.FITNESS_AI_TRAINER_ENABLED === 'false') {
            return NextResponse.json({ error: 'AI trainer is disabled' }, { status: 403 });
        }
        const authHeader = request.headers.get('authorization');
        if (!authHeader) return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });

        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json()) as {
            profile: {
                goals: string[];
                training_level: string;
                session_duration_minutes: number;
                injuries_limitations?: string | null;
                equipment_access: string[];
                coaching_tone?: string;
                motivation_style?: string;
            };
        };
        if (!body?.profile) return NextResponse.json({ error: 'Profile is required' }, { status: 400 });

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
        });

        const { data: exercises, error: exerciseError } = await supabase
            .from('exercises')
            .select('slug,name,movement_pattern,mechanic,difficulty,instructions,tips,common_mistakes')
            .eq('is_published', true)
            .limit(200);

        if (exerciseError || !exercises || exercises.length === 0) {
            return NextResponse.json({ error: 'No exercises available for generation' }, { status: 500 });
        }

        const openai = getOpenAIClient();
        const prompt = `Create a personalized workout plan in JSON for this user profile:
${JSON.stringify(body.profile)}

Use only exercise slugs from this catalog:
${JSON.stringify(exercises.map((e: any) => ({ slug: e.slug, difficulty: e.difficulty, movement_pattern: e.movement_pattern, mechanic: e.mechanic })))}

Rules:
- Return 4 to 8 exercises
- Only JSON array, each item: { "exercise_slug": string, "sets": number, "rep_range": string, "rest_seconds": number, "note": string }
- Keep sets between 2 and 5
- Keep rest_seconds between 30 and 180
- Respect injuries_limitations by avoiding risky selections if possible
- Keep coaching notes concise and actionable`;

        const completion = await withTimeout(
            openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a certified personal trainer. Return valid JSON only.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.5,
                max_tokens: 1200,
            }),
            10000
        );

        const content = completion.choices[0]?.message?.content?.trim() ?? '[]';
        const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as Array<{
            exercise_slug: string;
            sets: number;
            rep_range: string;
            rest_seconds: number;
            note?: string;
        }>;
        const allowedSlugs = new Set((exercises as Array<{ slug: string }>).map((e) => e.slug));
        const validated = parsed
            .filter((item) => allowedSlugs.has(item.exercise_slug))
            .slice(0, 8)
            .map((item) => ({
                exercise_slug: item.exercise_slug,
                sets: clamp(Number(item.sets || 3), 2, 5),
                rep_range: (item.rep_range || '8-12 reps').slice(0, 40),
                rest_seconds: clamp(Number(item.rest_seconds || 75), 30, 180),
                note: item.note?.slice(0, 180) ?? null,
            }));
        try {
            await supabase.from('fitness_ai_coaching_events').insert({
                user_id: user.id,
                session_id: null,
                prompt_type: 'plan_generation',
                response_id: `plan-${Date.now()}`,
                response_text: `generated_items=${validated.length}`,
            });
        } catch (eventError) {
            console.error('Failed to log plan generation event:', eventError);
        }

        return NextResponse.json({ items: validated });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate AI plan' },
            { status: 500 }
        );
    }
}
