import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/newsfeed/topics
 * Get all available news topics
 * Public endpoint - no authentication required for reference data
 */
export async function GET(request: NextRequest) {
    try {
        // Topics are public reference data - use simple client with anon key
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
            },
        });

        const { data, error } = await supabase
            .from('newsfeed_topics')
            .select('*')
            .eq('is_active', true)
            .order('display_name');

        if (error) {
            throw error;
        }

        return NextResponse.json({ topics: data || [] });
    } catch (error) {
        console.error('Error fetching topics:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch topics' },
            { status: 500 }
        );
    }
}





