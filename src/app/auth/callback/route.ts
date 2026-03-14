import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Auth callback route - handles email confirmation links from Supabase.
 * When users click the link in the sign-up confirmation email, Supabase
 * redirects here with a `code` parameter. We exchange it for a session
 * and set cookies, then redirect to the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // Handle PKCE flow (code in query)
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Parameters<typeof cookieStore.set>[2]) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: Parameters<typeof cookieStore.set>[2]) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error('[auth/callback] Code exchange failed:', error.message);
  }

  return NextResponse.redirect(new URL('/login?error=Could+not+confirm+account', request.url));
}
