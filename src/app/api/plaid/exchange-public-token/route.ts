import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, PlaidEnvironments, type CountryCode } from 'plaid';

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
 * Exchange public token for access token
 * This is called after the user successfully connects their bank account via Plaid Link
 */
export async function POST(request: NextRequest) {
    try {
        // Get user from Supabase session
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
        
        // Verify the user first
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Create authenticated client using REST API for RLS
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            auth: {
                persistSession: false,
            },
        });

        const body = await request.json();
        const { public_token } = body;

        if (!public_token) {
            return NextResponse.json(
                { error: 'public_token is required' },
                { status: 400 }
            );
        }

        // Exchange public token for access token
        const exchangeResponse = await plaidClient.itemPublicTokenExchange({
            public_token,
        });

        const accessToken = exchangeResponse.data.access_token;
        const itemId = exchangeResponse.data.item_id;

        // Get institution info
        const itemResponse = await plaidClient.itemGet({
            access_token: accessToken,
        });

        const institutionId = itemResponse.data.item.institution_id || null;
        let institutionName = null;

        if (institutionId) {
            try {
                const institutionResponse = await plaidClient.institutionsGetById({
                    institution_id: institutionId,
                    country_codes: ['US' as CountryCode],
                });
                institutionName = institutionResponse.data.institution.name;
            } catch (err) {
                console.error('Error fetching institution info:', err);
            }
        }

        // Store the Plaid item in the database using REST API with user's token for RLS
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/plaid_items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': supabaseAnonKey,
                'Prefer': 'return=representation',
            },
            body: JSON.stringify({
                user_id: user.id,
                item_id: itemId,
                access_token: accessToken, // In production, encrypt this
                institution_id: institutionId,
                institution_name: institutionName,
            }),
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            console.error('Error saving Plaid item:', errorText);
            return NextResponse.json(
                { error: 'Failed to save Plaid item', details: errorText },
                { status: 500 }
            );
        }

        const plaidItemArray = await insertResponse.json();
        const plaidItem = Array.isArray(plaidItemArray) ? plaidItemArray[0] : plaidItemArray;

        if (!plaidItem || !plaidItem.id) {
            return NextResponse.json(
                { error: 'Failed to save Plaid item', details: 'Invalid response from server' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            item_id: itemId,
            plaid_item_id: plaidItem.id,
            message: 'Successfully connected bank account',
        });
    } catch (error) {
        console.error('Error exchanging public token:', error);
        
        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to exchange public token' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}



