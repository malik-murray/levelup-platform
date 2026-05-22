import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key is not configured');
    return new OpenAI({ apiKey });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('AI request timed out')), ms)
        ),
    ]);
}

type CoachingRequest = {
    moment: 'session_start' | 'exercise_start' | 'pre_last_set' | 'session_finish';
    sessionName: string;
    exerciseName?: string;
    targetSets?: number;
    targetRepRange?: string;
    trainingLevel?: string;
    coachingTone?: string;
    motivationStyle?: string;
};

export async function POST(request: NextRequest) {
    try {
        if (process.env.FITNESS_AI_TRAINER_ENABLED === 'false') {
            return NextResponse.json({
                howTo: 'Move with control and use a full, comfortable range of motion.',
                focusCue: 'Prioritize clean reps over speed.',
                motivationCue: 'One strong set at a time. You are building momentum.',
            });
        }
        const body = (await request.json()) as CoachingRequest;
        const openai = getOpenAIClient();
        const prompt = `Return JSON with keys: howTo, focusCue, motivationCue.
Context: ${JSON.stringify(body)}
Rules:
- Keep each field under 180 characters.
- Make cues actionable and safe.
- Mention the exercise if provided.
- Tone should match coachingTone and motivationStyle.`;
        const completion = await withTimeout(
            openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.5,
                max_tokens: 300,
                messages: [
                    { role: 'system', content: 'You are an elite personal trainer. Return valid JSON only.' },
                    { role: 'user', content: prompt },
                ],
            }),
            6000
        );
        const content = completion.choices[0]?.message?.content?.trim() ?? '{}';
        const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as {
            howTo?: string;
            focusCue?: string;
            motivationCue?: string;
        };
        return NextResponse.json({
            howTo: parsed.howTo ?? 'Move with intent and control every rep.',
            focusCue: parsed.focusCue ?? 'Brace, breathe, and keep your form sharp.',
            motivationCue: parsed.motivationCue ?? 'Stay locked in. Finish this block strong.',
        });
    } catch (error) {
        return NextResponse.json(
            {
                howTo: 'Use controlled tempo and stable posture for each rep.',
                focusCue: 'Track your reps and maintain quality through the final set.',
                motivationCue: 'Keep going. Consistency beats perfection.',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 200 }
        );
    }
}
