import { createHash, timingSafeEqual } from 'node:crypto';
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';
import type { PlaidApi } from 'plaid';

const jwkCache = new Map<string, JWK>();

/**
 * Verify Plaid-Verification JWT and that the raw body matches request_body_sha256.
 * @see https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export async function verifyPlaidWebhook(
    rawBody: string,
    plaidVerificationJwt: string,
    plaidClient: PlaidApi
): Promise<boolean> {
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
        header = decodeProtectedHeader(plaidVerificationJwt);
    } catch {
        return false;
    }

    if (header.alg !== 'ES256' || typeof header.kid !== 'string' || !header.kid) {
        return false;
    }

    let jwk = jwkCache.get(header.kid);
    if (!jwk) {
        try {
            const res = await plaidClient.webhookVerificationKeyGet({
                key_id: header.kid,
            });
            jwk = res.data.key as JWK;
            jwkCache.set(header.kid, jwk);
        } catch {
            return false;
        }
    }

    try {
        const key = await importJWK(jwk);
        const { payload } = await jwtVerify(plaidVerificationJwt, key, {
            maxTokenAge: '5 min',
        });
        const claimed = payload.request_body_sha256;
        if (typeof claimed !== 'string' || !claimed) {
            return false;
        }
        const digest = createHash('sha256').update(rawBody, 'utf8').digest('hex');
        const a = Buffer.from(digest, 'utf8');
        const b = Buffer.from(claimed, 'utf8');
        if (a.length !== b.length) {
            return false;
        }
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}
