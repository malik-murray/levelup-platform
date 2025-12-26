import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { uploadStatementFile } from '@/lib/financial-concierge/statementImportService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/upload-statement
 * Upload a statement file (PDF or CSV)
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const accountId = formData.get('account_id') as string | null;
        const userConsent = formData.get('user_consent') === 'true';

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        if (!userConsent) {
            return NextResponse.json(
                { error: 'User consent required' },
                { status: 400 }
            );
        }

        const result = await uploadStatementFile(
            user.id,
            file,
            accountId || null,
            userConsent
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to upload statement file' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            statement_file_id: result.statement_file_id,
            file_name: result.file_name,
            message: 'Statement file uploaded successfully',
        });
    } catch (error) {
        console.error('Error uploading statement:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload statement' },
            { status: 500 }
        );
    }
}

