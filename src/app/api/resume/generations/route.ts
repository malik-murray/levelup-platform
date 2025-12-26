import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/resume/auth';
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
    const requestUserId = searchParams.get('userId');

    // Try to get user ID from query param first (passed from client), then from auth
    let userId: string | undefined = requestUserId || undefined;
    
    if (!userId) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    if (generationId) {
      const generation = await getGeneration(generationId, userId);
      return NextResponse.json({ generation });
    }

    const generations = await getGenerations(userId, limit, offset);
    return NextResponse.json({ generations });
  } catch (error) {
    console.error('Error fetching generations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}



