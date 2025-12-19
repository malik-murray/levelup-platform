import { NextRequest, NextResponse } from 'next/server';
import { getTemplates } from '@/lib/resume/db';

/**
 * GET: Fetch all templates or filter by type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'resume' | 'cover_letter' | null;

    const templates = await getTemplates(type || undefined);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

