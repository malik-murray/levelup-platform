import { SignJWT, jwtVerify } from 'jose';

export type NotificationActionPayload = {
    userId: string;
    transactionId: string;
};

function secretKey(): Uint8Array | null {
    const raw =
        process.env.NOTIFICATION_ACTION_SECRET?.trim() ||
        process.env.CRON_SECRET?.trim() ||
        process.env.VAPID_PRIVATE_KEY?.trim();
    if (!raw) return null;
    return new TextEncoder().encode(raw);
}

export async function createNotificationActionToken(
    payload: NotificationActionPayload
): Promise<string | null> {
    const key = secretKey();
    if (!key) return null;
    return new SignJWT({
        uid: payload.userId,
        tx: payload.transactionId,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('48h')
        .sign(key);
}

export async function verifyNotificationActionToken(
    token: string,
    expected: NotificationActionPayload
): Promise<boolean> {
    const key = secretKey();
    if (!key) return false;
    try {
        const { payload } = await jwtVerify(token, key);
        return payload.uid === expected.userId && payload.tx === expected.transactionId;
    } catch {
        return false;
    }
}
