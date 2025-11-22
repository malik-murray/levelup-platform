import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type CommitRequest = {
    accountId: string;
    transactions: {
        date: string;
        description: string;
        amount: number;
        categoryId?: string | null;
    }[];
};

/**
 * Commit endpoint for importing transactions
 * Accepts parsed transactions and inserts them into Supabase
 */
export async function POST(request: NextRequest) {
    try {
        const body: CommitRequest = await request.json();

        if (!body.accountId || !body.transactions || !Array.isArray(body.transactions)) {
            return NextResponse.json(
                { error: 'Invalid request: accountId and transactions array required' },
                { status: 400 }
            );
        }

        if (body.transactions.length === 0) {
            return NextResponse.json(
                { error: 'No transactions to import' },
                { status: 400 }
            );
        }

        // Get Supabase client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Transform to database format
        const rowsToInsert = body.transactions.map(tx => ({
            date: tx.date,
            amount: tx.amount,
            person: tx.description.slice(0, 255),
            note: null,
            account_id: body.accountId,
            category_id: tx.categoryId || null,
        }));

        // Insert into database
        const { error, data } = await supabase
            .from('transactions')
            .insert(rowsToInsert)
            .select();

        if (error) {
            console.error('Database insert error:', error);
            return NextResponse.json(
                { error: 'Failed to save transactions to database', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            insertedCount: rowsToInsert.length,
            skippedCount: 0,
            message: `Successfully imported ${rowsToInsert.length} transactions`,
        });
    } catch (error) {
        console.error('Commit import error:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to commit transactions' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}


