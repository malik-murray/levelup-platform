import { NextRequest, NextResponse } from 'next/server';
import { generateInsights } from '@/lib/financial-concierge/insightEngine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/jobs/weekly-insights
 * Weekly insights job: regenerates insights for current month
 * Should be called by a cron job weekly
 */
export async function POST(request: NextRequest) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'change-me-in-production';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
            },
        });

        // Get current month
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get all users with profiles
        const { data: profiles } = await supabase
            .from('user_profile')
            .select('user_id');

        const userIds = (profiles || []).map(p => p.user_id);
        const results: Array<{ userId: string; success: boolean; error?: string }> = [];

        // Generate insights for each user
        for (const userId of userIds) {
            try {
                await generateInsights({
                    userId,
                    month: currentMonth,
                });
                results.push({ userId, success: true });
            } catch (error) {
                results.push({
                    userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            insights_generated: results.filter(r => r.success).length,
            total_users: userIds.length,
            errors: results.filter(r => !r.success).map(r => `User ${r.userId}: ${r.error}`),
        });
    } catch (error) {
        console.error('Error in weekly insights job:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Weekly insights job failed' },
            { status: 500 }
        );
    }
}










