import { NextRequest, NextResponse } from 'next/server';
import { monthlySyncJob } from '@/lib/financial-concierge/transactionSyncService';
import { generateBudgetPlan } from '@/lib/financial-concierge/budgetEngine';
import { generateInsights } from '@/lib/financial-concierge/insightEngine';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/jobs/monthly-refresh
 * Monthly refresh job: syncs transactions, generates budgets, and insights
 * Should be called by a cron job monthly
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

        // 1. Sync transactions for all users (last 90 days)
        const syncResult = await monthlySyncJob();

        // 2. Get all users with profiles
        const { data: profiles } = await supabase
            .from('user_profile')
            .select('user_id');

        const userIds = (profiles || []).map(p => p.user_id);
        const budgetResults: Array<{ userId: string; success: boolean; error?: string }> = [];
        const insightResults: Array<{ userId: string; success: boolean; error?: string }> = [];

        // 3. Generate budgets and insights for each user
        for (const userId of userIds) {
            try {
                await generateBudgetPlan({
                    userId,
                    month: currentMonth,
                    sourceDataDays: 90,
                });
                budgetResults.push({ userId, success: true });
            } catch (error) {
                budgetResults.push({
                    userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }

            try {
                await generateInsights({
                    userId,
                    month: currentMonth,
                });
                insightResults.push({ userId, success: true });
            } catch (error) {
                insightResults.push({
                    userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            success: true,
            sync: syncResult,
            budgets_generated: budgetResults.filter(r => r.success).length,
            insights_generated: insightResults.filter(r => r.success).length,
            errors: [
                ...budgetResults.filter(r => !r.success).map(r => `Budget ${r.userId}: ${r.error}`),
                ...insightResults.filter(r => !r.success).map(r => `Insights ${r.userId}: ${r.error}`),
            ],
        });
    } catch (error) {
        console.error('Error in monthly refresh job:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Monthly refresh job failed' },
            { status: 500 }
        );
    }
}




