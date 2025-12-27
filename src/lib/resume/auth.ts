// Helper function to create authenticated Supabase client in API routes
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

export async function getAuthenticatedSupabase(request?: NextRequest) {
  const cookieStore = await cookies();
  
  // In API routes, we need to read cookies from the request headers as a fallback
  // because cookies() might not have access to all cookies in API routes
  const getCookie = (name: string): string | undefined => {
    // First try cookieStore
    const cookie = cookieStore.get(name);
    if (cookie) return cookie.value;
    
    // Fallback: read from request headers if available
    if (request) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, ...valueParts] = cookie.trim().split('=');
          const value = valueParts.join('='); // Handle values with = in them
          acc[key.trim()] = decodeURIComponent(value);
          return acc;
        }, {} as Record<string, string>);
        return cookies[name];
      }
    }
    
    return undefined;
  };
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name);
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // The `set` method was called from a Server Component or API route.
            // This can be ignored if you have middleware refreshing user sessions.
            // In API routes, cookies are set via response headers, not directly
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Same as above
          }
        },
      },
    }
  );
}

export async function getAuthenticatedUser(request?: NextRequest) {
  try {
    const supabase = await getAuthenticatedSupabase(request);
    
    // Try getSession() first (same as root page.tsx)
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (session?.user) {
      return session.user;
    }
    
    // Fallback to getUser() if getSession() doesn't work
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth error in getAuthenticatedUser:', error.message, error.status);
      return null;
    }
    
    if (!user) {
      console.log('No user found in getAuthenticatedUser');
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Exception in getAuthenticatedUser:', error);
    return null;
  }
}




