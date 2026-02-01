import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/newsfeed/sources
 * Get all available news sources
 * Public endpoint - no authentication required for reference data
 */
export async function GET(request: NextRequest) {
    try {
        // Sources are public reference data - use simple client with anon key
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
            },
        });

        const { data, error } = await supabase
            .from('newsfeed_sources')
            .select('*')
            .eq('is_active', true)
            .order('display_name');

        if (error) {
            throw error;
        }

        return NextResponse.json({ sources: data || [] });
    } catch (error) {
        console.error('Error fetching sources:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch sources' },
            { status: 500 }
        );
    }
}





