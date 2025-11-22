import { NextRequest, NextResponse } from 'next/server';
import { parsePdfTransactions } from '@/lib/pdfParser';

/**
 * Parse-only endpoint for PDF imports
 * Does NOT insert into database - returns parsed transactions for preview
 */
export async function POST(request: NextRequest) {
    try {
        // Get the file from FormData
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (file.type !== 'application/pdf') {
            return NextResponse.json(
                { error: 'File must be a PDF' },
                { status: 400 }
            );
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PDF (no database insert)
        let parsedTransactions;
        try {
            parsedTransactions = await parsePdfTransactions(buffer);
        } catch (parseError) {
            console.error('PDF parsing error:', parseError);
            // Re-throw to be caught by outer catch block
            throw parseError;
        }

        if (parsedTransactions.length === 0) {
            console.error('PDF parsed but returned 0 transactions');
            return NextResponse.json(
                {
                    error: 'No transactions found in PDF',
                    message:
                        'We couldn\'t detect any transactions in this PDF. Try another file or export as CSV from your bank.',
                },
                { status: 400 }
            );
        }

        // Return parsed transactions for preview
        return NextResponse.json({
            success: true,
            transactions: parsedTransactions,
            count: parsedTransactions.length,
        });
    } catch (error) {
        console.error('PDF parse error:', error);

        if (error instanceof Error) {
            // Check if it's a parsing error
            if (error.message.includes('format') || error.message.includes('parsed') || error.message.includes('No transactions')) {
                return NextResponse.json(
                    {
                        error: 'PDF parsing failed',
                        message:
                            'We couldn\'t detect any transactions in this PDF. Try another file or export as CSV from your bank.',
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { error: error.message || 'Failed to parse PDF' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

