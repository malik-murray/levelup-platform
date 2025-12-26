import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/resume/auth';
import {
  getUserProfileDefaults,
  upsertUserProfileDefaults,
} from '@/lib/resume/db';
import type { UserProfileDefaults } from '@/lib/resume/types';

/**
 * GET: Fetch user profile defaults
 * POST/PUT: Update user profile defaults
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getUserProfileDefaults(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profile' },
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

    const body: Partial<UserProfileDefaults> = await request.json();
    const profile = await upsertUserProfileDefaults(user.id, body);

    return NextResponse.json({ profile, success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return POST(request); // Same as POST for upsert
}


