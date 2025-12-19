import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/resume/auth';
import { getUserCredits, addCredits } from '@/lib/resume/db';

/**
 * GET: Fetch user credits
 * POST: Add credits (for admin/testing - in production, use payment integration)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const credits = await getUserCredits(user.id);
    const remaining = credits
      ? credits.total_credits - credits.used_credits
      : 0;

    return NextResponse.json({
      credits: credits || { total_credits: 0, used_credits: 0 },
      remaining,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const amount = parseInt(body.amount || '0', 10);

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const credits = await addCredits(user.id, amount);
    const remaining = credits.total_credits - credits.used_credits;

    return NextResponse.json({
      credits,
      remaining,
      success: true,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add credits' },
      { status: 500 }
    );
  }
}

