import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

let plaidClient: PlaidApi | null = null;

export function getPlaidApi(): PlaidApi {
    if (plaidClient) {
        return plaidClient;
    }
    const configuration = new Configuration({
        basePath:
            process.env.PLAID_ENV === 'production'
                ? PlaidEnvironments.production
                : PlaidEnvironments.sandbox,
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
                'PLAID-SECRET': process.env.PLAID_SECRET!,
            },
        },
    });
    plaidClient = new PlaidApi(configuration);
    return plaidClient;
}
