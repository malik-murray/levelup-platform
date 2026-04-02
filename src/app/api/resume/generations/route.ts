import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthenticatedSupabase } from '@/lib/resume/auth';
import { getGenerations, getGeneration } from '@/lib/resume/db';

/**
 * GET: Fetch user's generation history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const generationId = searchParams.get('id');

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getAuthenticatedSupabase(request);
    const userId = user.id;

    if (generationId) {
      const generation = await getGeneration(supabase, generationId, userId);
      return NextResponse.json({ generation });
    }

    const generations = await getGenerations(supabase, userId, limit, offset);
    return NextResponse.json({ generations });
  } catch (error) {
    console.error('Error fetching generations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}










