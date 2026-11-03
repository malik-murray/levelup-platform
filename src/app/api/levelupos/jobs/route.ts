import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { agentBackend, AgentBackendError } from '@/lib/levelupos/client';

export const runtime = 'nodejs';
export const maxDuration = 15;
const submission = z.object({
    message: z.string().trim().min(10).max(2000),
    request_id: z.string().uuid(),
}).strict();

function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof AgentBackendError ? error.message : 'Unable to process agent request.' },
        { status: error instanceof AgentBackendError ? error.status : 500 });
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) return NextResponse.json({ error: 'Sign in to view your runs.' }, { status: 401 });
        // Never accept a caller-supplied user ID or arbitrary upstream path.
        const result = await agentBackend(`jobs?user_id=${encodeURIComponent(auth.user.id)}`);
        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get('origin');
        if (origin && origin !== request.nextUrl.origin) {
            return NextResponse.json({ error: 'Cross-origin submissions are not allowed.' }, { status: 403 });
        }
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
            return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415 });
        }
        const auth = await getAuthenticatedUser(request);
        if (!auth) return NextResponse.json({ error: 'Sign in to start an agent.' }, { status: 401 });
        const text = await request.text();
        if (text.length > 12000) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
        let body: unknown;
        try { body = JSON.parse(text); }
        catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
        const parsed = submission.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: 'Enter a request of 10–2,000 characters and a valid request ID.' }, { status: 400 });
        const result = await agentBackend('jobs', {
            method: 'POST', body: JSON.stringify({ ...parsed.data, user_id: auth.user.id }),
        });
        return NextResponse.json(result, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
