import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type SubmitRequest = {
    testId: string;
    responses?: Array<{
        questionId: string;
        selectedOptionId: string;
        selectedOptionValue: number;
    }>;
    reflections?: Array<{
        questionId: string;
        reflectionText: string;
    }>;
    markComplete?: boolean;
};

/**
 * POST: Submit test responses and reflections
 */
export async function POST(request: NextRequest) {
    try {
        const body: SubmitRequest = await request.json();

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

        // Verify test belongs to user
        const { data: test, error: testError } = await supabase
            .from('emotional_tests')
            .select('id, user_id')
            .eq('id', body.testId)
            .eq('user_id', user.id)
            .single();

        if (testError || !test) {
            return NextResponse.json(
                { error: 'Test not found or access denied' },
                { status: 404 }
            );
        }

        const errors: string[] = [];

        // Insert or update responses
        if (body.responses && body.responses.length > 0) {
            const responseInserts = body.responses.map(r => ({
                test_id: body.testId,
                question_id: r.questionId,
                user_id: user.id,
                selected_option_id: r.selectedOptionId,
                selected_option_value: r.selectedOptionValue,
            }));

            // Use upsert to handle updates
            const { error: responseError } = await supabase
                .from('emotional_test_responses')
                .upsert(responseInserts, {
                    onConflict: 'test_id,question_id,user_id',
                });

            if (responseError) {
                errors.push(`Failed to save responses: ${responseError.message}`);
            }
        }

        // Insert or update reflections
        if (body.reflections && body.reflections.length > 0) {
            const reflectionInserts = body.reflections.map(r => ({
                test_id: body.testId,
                question_id: r.questionId,
                user_id: user.id,
                reflection_text: r.reflectionText,
            }));

            // Use upsert to handle updates
            const { error: reflectionError } = await supabase
                .from('emotional_test_reflections')
                .upsert(reflectionInserts, {
                    onConflict: 'test_id,question_id,user_id',
                });

            if (reflectionError) {
                errors.push(`Failed to save reflections: ${reflectionError.message}`);
            }
        }

        // Mark test as complete if requested
        if (body.markComplete) {
            const { error: updateError } = await supabase
                .from('emotional_tests')
                .update({ completed_at: new Date().toISOString() })
                .eq('id', body.testId)
                .eq('user_id', user.id);

            if (updateError) {
                errors.push(`Failed to mark test as complete: ${updateError.message}`);
            }
        }

        if (errors.length > 0) {
            return NextResponse.json(
                { error: 'Some operations failed', details: errors },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Responses and reflections saved successfully',
        });
    } catch (error) {
        console.error('Error submitting test:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

