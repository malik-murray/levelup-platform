import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/newsfeed/articles/[articleId]/actions
 * Update user action for an article (save, archive, summary length)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { articleId: string } }
) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch (error) {
                        // Ignore cookie set errors in API routes
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    } catch (error) {
                        // Ignore cookie remove errors
                    }
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const articleId = params.articleId;
        const body = await request.json();
        const { is_saved, is_archived, preferred_summary_length } = body;

        // Get existing action if any
        const { data: existing } = await supabase
            .from('newsfeed_user_article_actions')
            .select('*')
            .eq('user_id', user.id)
            .eq('article_id', articleId)
            .single();

        // Prepare update data
        const updateData: any = {
            user_id: user.id,
            article_id: articleId,
            updated_at: new Date().toISOString(),
        };

        if (is_saved !== undefined) {
            updateData.is_saved = is_saved;
        }
        if (is_archived !== undefined) {
            updateData.is_archived = is_archived;
        }
        if (preferred_summary_length !== undefined) {
            updateData.preferred_summary_length = preferred_summary_length;
        }

        // If existing, merge with existing values
        if (existing) {
            if (is_saved === undefined) updateData.is_saved = existing.is_saved;
            if (is_archived === undefined) updateData.is_archived = existing.is_archived;
            if (preferred_summary_length === undefined) updateData.preferred_summary_length = existing.preferred_summary_length;
        } else {
            // Set defaults for new records
            if (is_saved === undefined) updateData.is_saved = false;
            if (is_archived === undefined) updateData.is_archived = false;
            if (preferred_summary_length === undefined) updateData.preferred_summary_length = 1;
        }

        // Upsert action
        const { data, error } = await supabase
            .from('newsfeed_user_article_actions')
            .upsert(updateData, {
                onConflict: 'user_id,article_id',
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ action: data });
    } catch (error) {
        console.error('Error updating article action:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update article action' },
            { status: 500 }
        );
    }
}





