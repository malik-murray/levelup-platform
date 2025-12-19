import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'your-openai-api-key-here') {
            throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.');
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

type SuggestCategoryRequest = {
    transactionName: string;
    amount: number;
    date?: string;
};

type SuggestCategoryResponse = {
    categoryId: string | null;
    categoryName: string | null;
    confidence: number;
    reasoning: string;
};

/**
 * Suggests a category for a transaction using AI
 */
export async function POST(request: NextRequest) {
    try {
        const body: SuggestCategoryRequest = await request.json();

        if (!body.transactionName || body.amount === undefined) {
            return NextResponse.json(
                { error: 'transactionName and amount are required' },
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

        // Fetch all budgetable categories (kind='category', not groups) for this user
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('id, name, type, parent_id')
            .eq('user_id', user.id)
            .eq('kind', 'category')
            .order('name');

        if (categoriesError) {
            console.error('Error fetching categories:', categoriesError);
            return NextResponse.json(
                { error: 'Failed to fetch categories' },
                { status: 500 }
            );
        }

        if (!categories || categories.length === 0) {
            return NextResponse.json({
                categoryId: null,
                categoryName: null,
                confidence: 0,
                reasoning: 'No categories available',
            });
        }

        // Determine transaction type from amount
        const isExpense = body.amount < 0;
        const transactionType = isExpense ? 'expense' : 'income';

        // Filter categories by type
        const relevantCategories = categories.filter(
            cat => cat.type === transactionType || cat.type === null
        );

        if (relevantCategories.length === 0) {
            return NextResponse.json({
                categoryId: null,
                categoryName: null,
                confidence: 0,
                reasoning: `No ${transactionType} categories available`,
            });
        }

        // Build category list for AI
        const categoryList = relevantCategories
            .map(cat => `- ${cat.name} (ID: ${cat.id})`)
            .join('\n');

        // Get OpenAI client
        const openai = getOpenAIClient();

        // Create prompt for category suggestion
        const prompt = `You are a financial categorization assistant. Analyze the following transaction and suggest the most appropriate category.

Transaction Details:
- Name/Description: "${body.transactionName}"
- Amount: ${body.amount < 0 ? '-' : '+'}$${Math.abs(body.amount).toFixed(2)}
- Type: ${transactionType}
${body.date ? `- Date: ${body.date}` : ''}

Available Categories (${transactionType}):
${categoryList}

Instructions:
1. Analyze the transaction name/description to understand what it is
2. Match it to the most appropriate category from the list above
3. Consider common patterns:
   - Grocery stores → Food & Dining / Groceries
   - Gas stations → Transportation / Gas
   - Restaurants → Food & Dining / Restaurants
   - Utilities → Utilities / [specific utility]
   - Subscriptions → Subscriptions / [service name]
   - Transfers → Usually no category (transfer)
   - Salary/Payroll → Income / Salary
   - etc.

Respond with ONLY a JSON object in this exact format:
{
    "categoryId": "the-id-from-the-list-above-or-null",
    "categoryName": "the-category-name-or-null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of why this category was chosen"
}

If the transaction is clearly a transfer or doesn't match any category well, set categoryId and categoryName to null and confidence to a low value (< 0.5).`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a financial categorization assistant. Always respond with valid JSON only, no additional text.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 300,
        });

        const responseText = completion.choices[0]?.message?.content?.trim();
        if (!responseText) {
            throw new Error('Empty response from OpenAI');
        }

        // Parse JSON response
        let suggestion: SuggestCategoryResponse;
        try {
            // Remove any markdown code blocks if present
            const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            suggestion = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            throw new Error('Invalid JSON response from AI');
        }

        // Validate the suggestion
        if (!suggestion.categoryId || !suggestion.categoryName) {
            return NextResponse.json({
                categoryId: null,
                categoryName: null,
                confidence: suggestion.confidence || 0,
                reasoning: suggestion.reasoning || 'No suitable category found',
            });
        }

        // Verify the category exists
        const categoryExists = relevantCategories.some(cat => cat.id === suggestion.categoryId);
        if (!categoryExists) {
            return NextResponse.json({
                categoryId: null,
                categoryName: null,
                confidence: 0,
                reasoning: 'Suggested category not found in available categories',
            });
        }

        return NextResponse.json(suggestion);
    } catch (error) {
        console.error('Category suggestion error:', error);

        if (error instanceof Error) {
            if (error.message.includes('OpenAI API key')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }
            return NextResponse.json(
                { error: `Failed to suggest category: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}







