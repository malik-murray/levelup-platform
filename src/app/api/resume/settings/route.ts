import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/resume/auth';
import { getUserSettings, upsertUserSettings } from '@/lib/resume/db';
import type { UserSettings } from '@/lib/resume/types';

/**
 * GET: Fetch user settings
 * POST/PUT: Update user settings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserSettings(user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
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

    const body: Partial<UserSettings> = await request.json();
    const settings = await upsertUserSettings(user.id, body);

    return NextResponse.json({ settings, success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return POST(request); // Same as POST for upsert
}




