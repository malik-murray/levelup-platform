import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { runNewsfeedIngestionIfStale } from '@/lib/newsfeed/runIngestionIfStale';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isServiceRoleAuthorized(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    return Boolean(token && process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() {},
                remove() {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        const serviceAuthorized = isServiceRoleAuthorized(request);
        if (!user && !serviceAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds : undefined;
        const maxArticles = typeof body.maxArticles === 'number' ? body.maxArticles : undefined;
        const lookbackHours = typeof body.lookbackHours === 'number' ? body.lookbackHours : undefined;
        const force = body.force === true;

        const outcome = await runNewsfeedIngestionIfStale({
            sourceIds,
            maxArticles,
            lookbackHours,
            force,
        });

        return NextResponse.json({
            success: true,
            skipped: outcome.skipped,
            reason: outcome.reason,
            runId: outcome.runId,
            result: outcome.result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run ingestion';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
