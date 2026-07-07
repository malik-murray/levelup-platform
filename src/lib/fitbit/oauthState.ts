import { SignJWT, jwtVerify } from 'jose';

function getStateSecret(): Uint8Array {
    const secret =
        process.env.FITBIT_OAUTH_STATE_SECRET?.trim() ||
        process.env.FITBIT_CLIENT_SECRET?.trim() ||
        process.env.CRON_SECRET?.trim();

    if (!secret) {
        throw new Error('FITBIT_CLIENT_SECRET or FITBIT_OAUTH_STATE_SECRET must be set');
    }

    return new TextEncoder().encode(secret);
}

export async function signFitbitOAuthState(userId: string): Promise<string> {
    return new SignJWT({ userId, provider: 'fitbit' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(getStateSecret());
}

export async function verifyFitbitOAuthState(state: string): Promise<string> {
    const { payload } = await jwtVerify(state, getStateSecret());
    const userId = payload.userId;
    if (typeof userId !== 'string' || !userId) {
        throw new Error('Invalid OAuth state');
    }
    return userId;
}
