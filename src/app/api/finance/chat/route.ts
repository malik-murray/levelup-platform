import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase, getAuthenticatedUser } from '@/lib/resume/auth';
import {
    answerFinanceQuestion,
    type FinanceChatMessage,
} from '@/lib/finance/financeChatService';

type ChatRequestBody = {
    message?: string;
    history?: FinanceChatMessage[];
};

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json()) as ChatRequestBody;
        const message = body.message?.trim();
        if (!message) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }

        const history = Array.isArray(body.history)
            ? body.history
                  .filter(
                      (item): item is FinanceChatMessage =>
                          !!item &&
                          (item.role === 'user' || item.role === 'assistant') &&
                          typeof item.content === 'string'
                  )
                  .slice(-10)
            : [];

        const supabase = await getAuthenticatedSupabase(request);
        const result = await answerFinanceQuestion(supabase, user.id, message, history);

        return NextResponse.json({
            reply: result.reply,
            matchedCount: result.matchedCount,
            stats: {
                total: result.stats.total,
                monthlyAverage: result.stats.monthlyAverage,
                transactionCount: result.stats.transactionCount,
                monthsInRange: result.stats.monthsInRange,
            },
        });
    } catch (error) {
        console.error('Finance chat error:', error);
        const message =
            error instanceof Error ? error.message : 'Failed to answer finance question';
        const status = message.includes('OpenAI API key') ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
