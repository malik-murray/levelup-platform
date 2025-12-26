import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { processStatementFile } from '@/lib/financial-concierge/statementImportService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/process-statement
 * Process an uploaded statement file (parse and import transactions)
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

        const body = await request.json();
        const { statement_file_id, account_id } = body;

        if (!statement_file_id || !account_id) {
            return NextResponse.json(
                { error: 'Missing required fields: statement_file_id, account_id' },
                { status: 400 }
            );
        }

        const result = await processStatementFile(user.id, statement_file_id, account_id);

        return NextResponse.json({
            success: result.success,
            transactions_imported: result.transactions_imported,
            statement_period_id: result.statement_period_id,
            errors: result.errors,
            message: result.success
                ? `Imported ${result.transactions_imported} transactions`
                : 'Processing completed with errors',
        });
    } catch (error) {
        console.error('Error processing statement:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process statement' },
            { status: 500 }
        );
    }
}

