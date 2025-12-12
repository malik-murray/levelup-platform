import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client lazily
function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key is not configured');
    }
    return new OpenAI({ apiKey });
}

type GenerateSummaryRequest = {
    testId: string;
};

/**
 * POST: Generate AI-powered summary and resolutions based on test responses
 */
export async function POST(request: NextRequest) {
    try {
        const body: GenerateSummaryRequest = await request.json();

        if (!body.testId) {
            return NextResponse.json(
                { error: 'testId is required' },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // Get user from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                { error: 'Authorization header required' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '');

        // Create client with anon key to verify user
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', details: authError?.message },
                { status: 401 }
            );
        }

        // Create authenticated client using user's access token
        // This ensures RLS policies can use auth.uid()
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            auth: {
                persistSession: false,
            },
        });

        // Verify test belongs to user and is completed
        const { data: test, error: testError } = await supabase
            .from('emotional_tests')
            .select('id, user_id, completed_at')
            .eq('id', body.testId)
            .eq('user_id', user.id)
            .single();

        if (testError || !test) {
            return NextResponse.json(
                { error: 'Test not found or access denied' },
                { status: 404 }
            );
        }

        // Fetch all questions
        const { data: questions, error: questionsError } = await supabase
            .from('emotional_test_questions')
            .select('*')
            .eq('test_id', body.testId)
            .order('order_index');

        if (questionsError || !questions) {
            return NextResponse.json(
                { error: 'Failed to fetch questions' },
                { status: 500 }
            );
        }

        // Fetch all responses
        const { data: responses, error: responsesError } = await supabase
            .from('emotional_test_responses')
            .select('*')
            .eq('test_id', body.testId)
            .eq('user_id', user.id);

        if (responsesError) {
            return NextResponse.json(
                { error: 'Failed to fetch responses' },
                { status: 500 }
            );
        }

        // Fetch all reflections
        const { data: reflections, error: reflectionsError } = await supabase
            .from('emotional_test_reflections')
            .select('*')
            .eq('test_id', body.testId)
            .eq('user_id', user.id);

        if (reflectionsError) {
            return NextResponse.json(
                { error: 'Failed to fetch reflections' },
                { status: 500 }
            );
        }

        // Build context for AI analysis
        const responseMap = new Map(responses?.map(r => [r.question_id, r]) || []);
        const reflectionMap = new Map(reflections?.map(r => [r.question_id, r]) || []);

        let analysisContext = 'EMOTIONAL ASSESSMENT ANALYSIS\n\n';
        analysisContext += 'User Responses and Reflections:\n\n';

        questions.forEach((q, index) => {
            analysisContext += `Question ${index + 1}:\n`;
            analysisContext += `Type: ${q.question_type}\n`;
            analysisContext += `Question: ${q.question_text}\n`;
            
            if (q.scenario_description) {
                analysisContext += `Scenario: ${q.scenario_description}\n`;
            }

            const response = responseMap.get(q.id);
            if (response) {
                analysisContext += `Selected Answer: ${response.selected_option_id} (Value: ${response.selected_option_value})\n`;
                if (q.options) {
                    const options = q.options as Array<{ id: string; text: string }>;
                    const selectedOption = options.find(opt => opt.id === response.selected_option_id);
                    if (selectedOption) {
                        analysisContext += `Selected Option Text: ${selectedOption.text}\n`;
                    }
                }
            }

            const reflection = reflectionMap.get(q.id);
            if (reflection) {
                analysisContext += `User Reflection: ${reflection.reflection_text}\n`;
            }

            analysisContext += '\n---\n\n';
        });

        // Validate OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key is not configured' },
                { status: 500 }
            );
        }

        // Generate summary using OpenAI
        const openai = getOpenAIClient();
        
        const prompt = `You are an expert emotional intelligence and mental health counselor. Analyze the following emotional assessment responses and reflections to provide deep, personalized insights.

${analysisContext}

Your task is to:
1. Analyze the user's responses and reflections to identify emotional patterns, triggers, strengths, and areas for growth
2. Identify specific emotional traits, coping mechanisms, and behavioral patterns
3. Provide a comprehensive, personalized summary that:
   - Highlights key emotional traits and patterns you've identified
   - Explains why the user might feel certain ways based on their detailed reflections
   - Provides deeper insights into their mindset and emotional habits
   - Is empathetic, accurate, and based on the specific input provided
4. Generate tailored resolutions and actionable tips that:
   - Address specific patterns and challenges identified
   - Are practical and implementable
   - Build on the user's strengths
   - Help them develop healthier emotional habits

IMPORTANT:
- Base your analysis ONLY on the provided responses and reflections
- Be specific and reference their actual answers and reflections
- Avoid generic advice - make it personal and relevant
- Be empathetic and supportive, not judgmental
- Focus on actionable insights and growth opportunities

Respond with a JSON object in this exact format:
{
    "summary": "A comprehensive 3-4 paragraph summary of their emotional traits, patterns, and insights based on their responses. Reference specific answers and reflections.",
    "emotional_traits": {
        "primary_traits": ["trait1", "trait2", "trait3"],
        "strengths": ["strength1", "strength2"],
        "growth_areas": ["area1", "area2"],
        "coping_style": "description of their coping style",
        "emotional_expression": "description of how they express emotions"
    },
    "resolutions": "A detailed, actionable list of personalized resolutions and tips (3-5 paragraphs). Make it specific to their patterns and challenges identified in the analysis."
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert emotional intelligence counselor. Always respond with valid JSON only, no additional text or markdown formatting.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('Empty response from OpenAI API');
        }

        // Parse JSON response
        let analysisResult: {
            summary: string;
            emotional_traits: {
                primary_traits: string[];
                strengths: string[];
                growth_areas: string[];
                coping_style: string;
                emotional_expression: string;
            };
            resolutions: string;
        };

        try {
            // Remove any markdown code blocks if present
            const cleanedText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            analysisResult = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('Failed to parse AI response:', content);
            throw new Error('Invalid JSON response from AI');
        }

        // Save results to database
        const { error: saveError } = await supabase
            .from('emotional_test_results')
            .upsert({
                test_id: body.testId,
                user_id: user.id,
                summary: analysisResult.summary,
                emotional_traits: analysisResult.emotional_traits,
                resolutions: analysisResult.resolutions,
            }, {
                onConflict: 'test_id,user_id',
            });

        if (saveError) {
            console.error('Error saving results:', saveError);
            // Still return the results even if save fails
        }

        return NextResponse.json({
            success: true,
            summary: analysisResult.summary,
            emotionalTraits: analysisResult.emotional_traits,
            resolutions: analysisResult.resolutions,
        });
    } catch (error) {
        console.error('Error generating summary:', error);

        if (error instanceof Error) {
            if (error.message.includes('OpenAI API key')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }
            return NextResponse.json(
                { error: `Failed to generate summary: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

