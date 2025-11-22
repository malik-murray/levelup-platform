import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This route is deprecated. Use /api/import/pdf/parse for parsing
 * and /api/import/commit for committing transactions.
 * This route is kept for backward compatibility but should not be used.
 */
export async function POST(request: NextRequest) {
    return NextResponse.json(
        {
            error: 'This endpoint is deprecated',
            message: 'Please use the new import workflow: parse first, then commit after review.',
        },
        { status: 410 } // 410 Gone
    );
}

