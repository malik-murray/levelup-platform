import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';

// Initialize Plaid client
const configuration = new Configuration({
    basePath: process.env.PLAID_ENV === 'production' 
        ? PlaidEnvironments.production 
        : PlaidEnvironments.sandbox,
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
            'PLAID-SECRET': process.env.PLAID_SECRET!,
        },
    },
});

const plaidClient = new PlaidApi(configuration);

/**
 * Create a Link token for Plaid Link
 * This token is used to initialize the Plaid Link component on the frontend
 */
export async function POST(request: NextRequest) {
    try {
        // Check if Plaid credentials are configured
        const plaidClientId = process.env.PLAID_CLIENT_ID;
        const plaidSecret = process.env.PLAID_SECRET;
        
        // Debug logging (remove in production)
        console.log('Plaid Config Check:', {
            hasClientId: !!plaidClientId,
            clientIdLength: plaidClientId?.length || 0,
            clientIdPreview: plaidClientId ? `${plaidClientId.substring(0, 10)}...` : 'missing',
            hasSecret: !!plaidSecret,
            secretLength: plaidSecret?.length || 0,
        });
        
        if (!plaidClientId || plaidClientId === 'your_client_id' || plaidClientId.trim() === '') {
            console.error('Plaid Client ID not configured', { 
                value: plaidClientId,
                isPlaceholder: plaidClientId === 'your_client_id',
                isEmpty: !plaidClientId || plaidClientId.trim() === ''
            });
            return NextResponse.json(
                { 
                    error: 'Plaid Client ID not configured',
                    details: `Current value: "${plaidClientId || 'empty'}" - Please replace the placeholder with your actual Plaid Client ID from https://dashboard.plaid.com/team/keys`,
                    help: 'See PLAID_SETUP.md for setup instructions'
                },
                { status: 400 }
            );
        }
        
        if (!plaidSecret || plaidSecret === 'your_secret' || plaidSecret.trim() === '') {
            console.error('Plaid Secret not configured', { 
                hasValue: !!plaidSecret,
                isPlaceholder: plaidSecret === 'your_secret',
                isEmpty: !plaidSecret || plaidSecret.trim() === ''
            });
            return NextResponse.json(
                { 
                    error: 'Plaid Secret not configured',
                    details: `Current value is a placeholder - Please replace "your_secret" with your actual Plaid Secret from https://dashboard.plaid.com/team/keys`,
                    help: 'Get your credentials from https://dashboard.plaid.com/team/keys. See PLAID_SETUP.md for setup instructions'
                },
                { status: 400 }
            );
        }

        // Get user from Supabase session
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Get the authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                { error: 'Authorization header required' },
                { status: 401 }
            );
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.replace('Bearer ', '');
        
        // Verify the session
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', details: authError?.message },
                { status: 401 }
            );
        }

        // Create Link token
        try {
            const linkTokenResponse = await plaidClient.linkTokenCreate({
                user: {
                    client_user_id: user.id,
                },
                client_name: 'LevelUp Financial',
                products: [Products.Transactions, Products.Auth],
                country_codes: [CountryCode.Us],
                language: 'en',
                webhook: process.env.PLAID_WEBHOOK_URL || undefined,
            });

            return NextResponse.json({
                link_token: linkTokenResponse.data.link_token,
            });
        } catch (plaidError: any) {
            console.error('Plaid API error:', plaidError);
            // Plaid errors have a specific structure
            const errorMessage = plaidError?.response?.data?.error_message || 
                                plaidError?.message || 
                                'Failed to create Link token with Plaid';
            const errorCode = plaidError?.response?.data?.error_code || 'UNKNOWN';
            
            return NextResponse.json(
                { 
                    error: errorMessage,
                    error_code: errorCode,
                    details: 'Plaid API error. Check your Plaid credentials and environment settings.'
                },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error creating Link token:', error);
        
        if (error instanceof Error) {
            return NextResponse.json(
                { 
                    error: error.message || 'Failed to create Link token',
                    details: 'Unexpected error occurred'
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { 
                error: 'An unexpected error occurred',
                details: 'Unknown error'
            },
            { status: 500 }
        );
    }
}



