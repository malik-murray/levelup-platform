import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { runNewsfeedGraph } from '@/lib/newsfeed/graph/newsfeedGraph';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function isServiceRoleAuthorized(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return Boolean(token && serviceRole && token === serviceRole);
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

        const result = await runNewsfeedGraph({
            sourceIds,
            maxArticles,
            lookbackHours,
        });

        return NextResponse.json({
            success: true,
            runBy: user?.id || 'service-role',
            result,
        });
    } catch (error) {
        console.error('Error running newsfeed graph:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to run graph',
            },
            { status: 500 }
        );
    }
}
