import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'your-supabase-url-here') {
    throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL is not configured. Please set it in your .env.local file.\n' +
        'Get your Supabase URL from: https://app.supabase.com/project/_/settings/api\n' +
        'Format: https://xxxxx.supabase.co'
    );
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-supabase-anon-key-here') {
    throw new Error(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured. Please set it in your .env.local file.\n' +
        'Get your Supabase anon key from: https://app.supabase.com/project/_/settings/api'
    );
}

// Validate URL format
try {
    new URL(supabaseUrl);
} catch (error) {
    throw new Error(
        `Invalid Supabase URL format: "${supabaseUrl}"\n` +
        'The URL must be a valid HTTP or HTTPS URL.\n' +
        'Example: https://xxxxx.supabase.co\n' +
        'Get your URL from: https://app.supabase.com/project/_/settings/api'
    );
}

console.log('SUPABASE CLIENT INIT', {
    supabaseUrl,
    hasKey: !!supabaseAnonKey,
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

