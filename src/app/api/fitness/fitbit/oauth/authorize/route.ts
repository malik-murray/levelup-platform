import { NextRequest, NextResponse } from 'next/server';
import {
    FITBIT_AUTH_URL,
    FITBIT_SCOPES,
    getFitbitRedirectUri,
    isFitbitConfigured,
} from '@/lib/fitbit/fitbitConfig';
import { signFitbitOAuthState } from '@/lib/fitbit/oauthState';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start Fitbit OAuth — redirects the user to Fitbit's authorization page.
 */
export async function GET(request: NextRequest) {
    if (!isFitbitConfigured()) {
        return NextResponse.json(
            {
                error: 'Fitbit is not configured. Set FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL.',
            },
            { status: 503 }
        );
    }

    const auth = await getAuthenticatedUser(request);
    if (!auth) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', '/fitness/settings/integrations');
        return NextResponse.redirect(loginUrl);
    }

    const state = await signFitbitOAuthState(auth.user.id);
    const authorizeUrl = new URL(FITBIT_AUTH_URL);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', process.env.FITBIT_CLIENT_ID!);
    authorizeUrl.searchParams.set('redirect_uri', getFitbitRedirectUri());
    authorizeUrl.searchParams.set('scope', FITBIT_SCOPES.join(' '));
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('expires_in', '604800');

    return NextResponse.redirect(authorizeUrl.toString());
}
