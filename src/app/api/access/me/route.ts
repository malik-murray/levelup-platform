import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { getUserAccess } from '@/lib/access/getUserAccess';

export async function GET(request: NextRequest) {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
        return NextResponse.json({ tier: 'guest', email: null, userId: null });
    }

    const access = await getUserAccess(auth.user, auth.supabase);
    return NextResponse.json(access);
}
