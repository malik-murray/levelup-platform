import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Type definitions for emotional test data structures
interface EmotionResponse {
    question_id: string;
    selected_option_id?: string;
    selected_option_value?: number;
}

interface EmotionReflection {
    question_id: string;
    reflection_text: string;
}

interface EmotionQuestion {
    id: string;
    test_id: string;
    question_type: 'multiple_choice' | 'scenario';
    question_text: string;
    scenario_description?: string | null;
    options?: Array<{ id: string; text: string; value: number }> | null;
    order_index: number;
    created_at?: string;
}

/**
 * GET: Fetch test questions for a user
 * Creates a new test if one doesn't exist, or returns existing test with questions
 */
export async function GET(request: NextRequest) {
    try {
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

        // Verify user using Supabase client
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', details: authError?.message },
                { status: 401 }
            );
        }

        // Check if user has an incomplete test using REST API with user's token
        const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/emotional_tests?user_id=eq.${user.id}&completed_at=is.null&order=created_at.desc&limit=1`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                },
            }
        );

        let existingTest = null;
        if (checkResponse.ok) {
            const existingTests = await checkResponse.json();
            existingTest = Array.isArray(existingTests) && existingTests.length > 0 ? existingTests[0] : null;
        }

        let testId: string;

        if (existingTest && !existingTest.completed_at) {
            // Use existing incomplete test
            testId = existingTest.id;
        } else {
            // Create new test using REST API with user's token for RLS
            const createResponse = await fetch(`${supabaseUrl}/rest/v1/emotional_tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    name: 'Emotional Assessment',
                    description: 'A comprehensive assessment of your emotional patterns and responses',
                }),
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error('Error creating test:', errorText);
                console.error('User ID:', user.id);
                return NextResponse.json(
                    { 
                        error: 'Failed to create test', 
                        details: errorText || 'Unknown error',
                        hint: 'Make sure the database migration has been run (014_emotional_test_tables.sql)'
                    },
                    { status: 500 }
                );
            }

            const newTestArray = await createResponse.json();
            const newTest = Array.isArray(newTestArray) ? newTestArray[0] : newTestArray;
            
            if (!newTest || !newTest.id) {
                return NextResponse.json(
                    { 
                        error: 'Failed to create test', 
                        details: 'Invalid response from server',
                        hint: 'Make sure the database migration has been run (014_emotional_test_tables.sql)'
                    },
                    { status: 500 }
                );
            }

            testId = newTest.id;

            // Create default questions if this is a new test using REST API
            const questions = getDefaultQuestions(testId);
            const questionsResponse = await fetch(`${supabaseUrl}/rest/v1/emotional_test_questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(questions),
            });

            if (!questionsResponse.ok) {
                const errorText = await questionsResponse.text();
                console.error('Error creating questions:', errorText);
                // Continue anyway - questions might already exist
            }
        }

        // Fetch all questions for this test using REST API
        const questionsResponse = await fetch(
            `${supabaseUrl}/rest/v1/emotional_test_questions?test_id=eq.${testId}&order=order_index.asc`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                },
            }
        );

        if (!questionsResponse.ok) {
            const errorText = await questionsResponse.text();
            return NextResponse.json(
                { error: 'Failed to fetch questions', details: errorText },
                { status: 500 }
            );
        }

        const questions = await questionsResponse.json();

        // Fetch existing responses using REST API
        const responsesResponse = await fetch(
            `${supabaseUrl}/rest/v1/emotional_test_responses?test_id=eq.${testId}&user_id=eq.${user.id}&select=question_id,selected_option_id,selected_option_value`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                },
            }
        );
        const responses: EmotionResponse[] = responsesResponse.ok ? await responsesResponse.json() : [];

        // Fetch existing reflections using REST API
        const reflectionsResponse = await fetch(
            `${supabaseUrl}/rest/v1/emotional_test_reflections?test_id=eq.${testId}&user_id=eq.${user.id}&select=question_id,reflection_text`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                },
            }
        );
        const reflections: EmotionReflection[] = reflectionsResponse.ok ? await reflectionsResponse.json() : [];

        // Map responses and reflections to questions
        const responseMap = new Map<string, EmotionResponse>(
            responses.map((r: EmotionResponse) => [r.question_id, r])
        );
        const reflectionMap = new Map<string, EmotionReflection>(
            reflections.map((r: EmotionReflection) => [r.question_id, r])
        );

        const questionsWithAnswers = (questions as EmotionQuestion[])?.map((q: EmotionQuestion) => ({
            ...q,
            response: responseMap.get(q.id),
            reflection: reflectionMap.get(q.id),
        })) || [];

        return NextResponse.json({
            testId,
            questions: questionsWithAnswers,
        });
    } catch (error) {
        console.error('Error fetching test:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

/**
 * Default questions for the emotional test
 * Mix of multiple-choice and scenario-based questions
 */
function getDefaultQuestions(testId: string) {
    return [
        // Multiple-choice questions
        {
            test_id: testId,
            question_type: 'multiple_choice',
            question_text: 'How do you typically respond when faced with unexpected challenges?',
            scenario_description: null,
            options: [
                { id: 'a', text: 'I feel anxious and overwhelmed', value: 1 },
                { id: 'b', text: 'I take a moment to assess the situation calmly', value: 3 },
                { id: 'c', text: 'I immediately start problem-solving', value: 5 },
                { id: 'd', text: 'I seek help from others right away', value: 4 },
            ],
            order_index: 1,
        },
        {
            test_id: testId,
            question_type: 'multiple_choice',
            question_text: 'When someone criticizes your work, your first reaction is:',
            scenario_description: null,
            options: [
                { id: 'a', text: 'Defensive and hurt', value: 1 },
                { id: 'b', text: 'Curious to understand their perspective', value: 4 },
                { id: 'c', text: 'Grateful for the feedback', value: 5 },
                { id: 'd', text: 'Indifferent or dismissive', value: 2 },
            ],
            order_index: 2,
        },
        {
            test_id: testId,
            question_type: 'multiple_choice',
            question_text: 'How do you handle stress in your daily life?',
            scenario_description: null,
            options: [
                { id: 'a', text: 'I often feel overwhelmed and struggle to cope', value: 1 },
                { id: 'b', text: 'I use various coping strategies like exercise or meditation', value: 4 },
                { id: 'c', text: 'I break problems into smaller tasks', value: 5 },
                { id: 'd', text: 'I tend to avoid stressful situations', value: 2 },
            ],
            order_index: 3,
        },
        {
            test_id: testId,
            question_type: 'multiple_choice',
            question_text: 'When you make a mistake, you usually:',
            scenario_description: null,
            options: [
                { id: 'a', text: 'Dwell on it and feel guilty for a long time', value: 1 },
                { id: 'b', text: 'Learn from it and move on quickly', value: 5 },
                { id: 'c', text: 'Blame external factors', value: 2 },
                { id: 'd', text: 'Analyze what went wrong and plan to prevent it', value: 4 },
            ],
            order_index: 4,
        },
        {
            test_id: testId,
            question_type: 'multiple_choice',
            question_text: 'How do you feel about expressing your emotions to others?',
            scenario_description: null,
            options: [
                { id: 'a', text: 'Very uncomfortable - I keep emotions to myself', value: 1 },
                { id: 'b', text: 'Comfortable with close friends and family', value: 4 },
                { id: 'c', text: 'Very comfortable - I express emotions openly', value: 5 },
                { id: 'd', text: 'It depends on the situation and person', value: 3 },
            ],
            order_index: 5,
        },
        // Scenario-based questions
        {
            test_id: testId,
            question_type: 'scenario',
            question_text: 'Reflect on this scenario and share your thoughts',
            scenario_description: 'You\'ve been working on an important project for weeks, and just before the deadline, you realize you made a critical error that will require significant rework. Your manager is counting on you, and several team members are depending on your work.',
            options: null,
            order_index: 6,
        },
        {
            test_id: testId,
            question_type: 'scenario',
            question_text: 'Reflect on this scenario and share your thoughts',
            scenario_description: 'A close friend cancels plans with you at the last minute for the third time this month. They give a reasonable excuse, but you can\'t help feeling disappointed and wondering if they value your friendship.',
            options: null,
            order_index: 7,
        },
        {
            test_id: testId,
            question_type: 'scenario',
            question_text: 'Reflect on this scenario and share your thoughts',
            scenario_description: 'You receive unexpected praise and recognition for something you worked hard on. Your colleagues are congratulating you, and your supervisor mentions it in a team meeting.',
            options: null,
            order_index: 8,
        },
        {
            test_id: testId,
            question_type: 'scenario',
            question_text: 'Reflect on this scenario and share your thoughts',
            scenario_description: 'You\'re in a situation where you have to choose between two important commitments: helping a family member in need or attending a professional opportunity that could advance your career.',
            options: null,
            order_index: 9,
        },
        {
            test_id: testId,
            question_type: 'scenario',
            question_text: 'Reflect on this scenario and share your thoughts',
            scenario_description: 'You notice that you\'ve been feeling consistently low or anxious for several weeks, even when things in your life seem to be going well. You\'re not sure why you feel this way.',
            options: null,
            order_index: 10,
        },
    ];
}

