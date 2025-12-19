import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type CheckDuplicatesRequest = {
    transactions: {
        date: string;
        description: string;
        amount: number;
    }[];
    accountId?: string;
};

type DuplicateCheckResult = {
    date: string;
    description: string;
    amount: number;
    isDuplicate: boolean;
    existingTransactionId?: string;
    existingCategoryId?: string | null;
    suggestedCategoryId?: string | null;
    suggestedCategoryName?: string | null;
};

/**
 * Checks for duplicate transactions and suggests categories based on existing transactions
 */
export async function POST(request: NextRequest) {
    try {
        const body: CheckDuplicatesRequest = await request.json();

        if (!body.transactions || !Array.isArray(body.transactions)) {
            return NextResponse.json(
                { error: 'Invalid request: transactions array required' },
                { status: 400 }
            );
        }

        // Get authenticated user from cookies
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized - you must be logged in' },
                { status: 401 }
            );
        }

        // Fetch all existing transactions for duplicate checking
        // We'll check within a date range to optimize
        const allDates = body.transactions.map(tx => tx.date);
        const minDate = Math.min(...allDates.map(d => new Date(d).getTime()));
        const maxDate = Math.max(...allDates.map(d => new Date(d).getTime()));
        
        const dateRangeStart = new Date(minDate);
        dateRangeStart.setDate(dateRangeStart.getDate() - 7); // Check 7 days before
        const dateRangeEnd = new Date(maxDate);
        dateRangeEnd.setDate(dateRangeEnd.getDate() + 7); // Check 7 days after

        const { data: existingTransactions, error: fetchError } = await supabase
            .from('transactions')
            .select('id, date, amount, name, note, category_id, account_id')
            .eq('user_id', user.id)
            .gte('date', dateRangeStart.toISOString().slice(0, 10))
            .lte('date', dateRangeEnd.toISOString().slice(0, 10))
            .order('date', { ascending: false });

        if (fetchError) {
            console.error('Error fetching existing transactions:', fetchError);
            return NextResponse.json(
                { error: 'Failed to check for duplicates' },
                { status: 500 }
            );
        }

        // Normalize description for comparison (remove extra spaces, lowercase)
        const normalizeDescription = (desc: string): string => {
            return desc.toLowerCase().trim().replace(/\s+/g, ' ');
        };

        // Build a map of existing transactions by normalized description and amount
        // This helps us find matches even if descriptions vary slightly
        const existingTxMap = new Map<string, Array<{
            id: string;
            date: string;
            amount: number;
            categoryId: string | null;
            description: string;
        }>>();

        (existingTransactions || []).forEach(tx => {
            const description = normalizeDescription(tx.name || tx.note || '');
            const key = `${description}|${Math.abs(tx.amount).toFixed(2)}`;
            if (!existingTxMap.has(key)) {
                existingTxMap.set(key, []);
            }
            existingTxMap.get(key)!.push({
                id: tx.id,
                date: tx.date,
                amount: tx.amount,
                categoryId: tx.category_id,
                description: tx.name || tx.note || '',
            });
        });

        // Build category suggestion map based on existing transactions
        // Maps normalized description patterns to most common category
        const categorySuggestionMap = new Map<string, {
            categoryId: string | null;
            categoryName: string | null;
            count: number;
        }>();

        (existingTransactions || []).forEach(tx => {
            if (!tx.category_id) return;
            const description = normalizeDescription(tx.name || tx.note || '');
            // Use first few words as pattern (more flexible matching)
            const words = description.split(' ').slice(0, 3).join(' ');
            const key = words;
            
            if (!categorySuggestionMap.has(key)) {
                categorySuggestionMap.set(key, {
                    categoryId: tx.category_id,
                    categoryName: null, // We'll fetch names if needed
                    count: 0,
                });
            }
            const entry = categorySuggestionMap.get(key)!;
            if (entry.categoryId === tx.category_id) {
                entry.count++;
            }
        });

        // Fetch category names for suggestions
        const categoryIds = Array.from(new Set(
            Array.from(categorySuggestionMap.values())
                .map(e => e.categoryId)
                .filter(id => id !== null) as string[]
        ));

        const { data: categories } = await supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', user.id)
            .in('id', categoryIds);

        const categoryNameMap = new Map<string, string>();
        (categories || []).forEach(cat => {
            categoryNameMap.set(cat.id, cat.name);
        });

        // Update suggestion map with category names
        categorySuggestionMap.forEach((value, key) => {
            if (value.categoryId && categoryNameMap.has(value.categoryId)) {
                value.categoryName = categoryNameMap.get(value.categoryId)!;
            }
        });

        // Check each transaction for duplicates and suggest categories
        const results: DuplicateCheckResult[] = body.transactions.map(tx => {
            const normalizedDesc = normalizeDescription(tx.description);
            const amountKey = Math.abs(tx.amount).toFixed(2);
            const matchKey = `${normalizedDesc}|${amountKey}`;
            
            // Check for exact duplicate (same description and amount)
            const exactMatches = existingTxMap.get(matchKey) || [];
            const isDuplicate = exactMatches.some(match => {
                const dateDiff = Math.abs(
                    new Date(match.date).getTime() - new Date(tx.date).getTime()
                );
                // Consider duplicate if within 3 days and same amount
                return dateDiff <= 3 * 24 * 60 * 60 * 1000;
            });

            const duplicateMatch = exactMatches.find(match => {
                const dateDiff = Math.abs(
                    new Date(match.date).getTime() - new Date(tx.date).getTime()
                );
                return dateDiff <= 3 * 24 * 60 * 60 * 1000;
            });

            // Suggest category based on existing transactions with similar descriptions
            let suggestedCategoryId: string | null = null;
            let suggestedCategoryName: string | null = null;

            if (duplicateMatch && duplicateMatch.categoryId) {
                // Use category from duplicate
                suggestedCategoryId = duplicateMatch.categoryId;
                suggestedCategoryName = categoryNameMap.get(duplicateMatch.categoryId) || null;
            } else {
                // Try to find pattern match
                const words = normalizedDesc.split(' ').slice(0, 3).join(' ');
                const patternMatch = categorySuggestionMap.get(words);
                if (patternMatch && patternMatch.count >= 1) {
                    suggestedCategoryId = patternMatch.categoryId;
                    suggestedCategoryName = patternMatch.categoryName;
                } else {
                    // Try partial matches (first 2 words, then first word)
                    const twoWords = normalizedDesc.split(' ').slice(0, 2).join(' ');
                    const oneWord = normalizedDesc.split(' ')[0];
                    
                    const twoWordMatch = categorySuggestionMap.get(twoWords);
                    const oneWordMatch = categorySuggestionMap.get(oneWord);
                    
                    if (twoWordMatch && twoWordMatch.count >= 2) {
                        suggestedCategoryId = twoWordMatch.categoryId;
                        suggestedCategoryName = twoWordMatch.categoryName;
                    } else if (oneWordMatch && oneWordMatch.count >= 3) {
                        suggestedCategoryId = oneWordMatch.categoryId;
                        suggestedCategoryName = oneWordMatch.categoryName;
                    }
                }
            }

            return {
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                isDuplicate,
                existingTransactionId: duplicateMatch?.id,
                existingCategoryId: duplicateMatch?.categoryId || null,
                suggestedCategoryId,
                suggestedCategoryName,
            };
        });

        return NextResponse.json({
            success: true,
            results,
        });
    } catch (error) {
        console.error('Check duplicates error:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to check duplicates' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

