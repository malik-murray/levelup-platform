// Only import this module from server routes. Never expose this key to browser code.
export class AgentBackendError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export async function agentBackend(path: string, init: RequestInit = {}) {
    const address = process.env.LEVELUPOS_AGENTOS_URL;
    const key = process.env.LEVELUPOS_AGENTOS_KEY;
    if (!address || !key) throw new AgentBackendError(503, 'Agent backend is not connected yet.');
    const url = new URL(address);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        throw new AgentBackendError(503, 'Agent backend requires HTTPS.');
    }
    let response: Response;
    try {
        response = await fetch(`${address.replace(/\/$/, '')}/levelupos/${path}`, {
            ...init, cache: 'no-store', redirect: 'error',
            headers: { ...init.headers, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
    } catch {
        throw new AgentBackendError(502, 'Agent backend could not be reached.');
    }
    if (!response.ok) {
        const messages: Record<number, string> = {
            409: 'You already have an active run. Refresh its status below.',
            429: 'Daily run limit reached. Try again after midnight UTC.',
            503: 'Agent backend is not ready. Check its deployment and model credentials.',
        };
        throw new AgentBackendError(messages[response.status] ? response.status : 502,
            messages[response.status] ?? 'Agent backend returned an error.');
    }
    return response.json();
}
