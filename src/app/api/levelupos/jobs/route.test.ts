import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { agentBackend } from '@/lib/levelupos/client';

jest.mock('@/lib/auth/getAuthenticatedUser', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/levelupos/client', () => ({
    ...jest.requireActual('@/lib/levelupos/client'), agentBackend: jest.fn(),
}));
const auth = jest.mocked(getAuthenticatedUser);
const backend = jest.mocked(agentBackend);
const request = (body: unknown) => new NextRequest('http://localhost/api/levelupos/jobs', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
});
beforeEach(() => { jest.resetAllMocks(); });

test('unauthenticated callers cannot submit or read runs', async () => {
    auth.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect((await GET(new NextRequest('http://localhost/api/levelupos/jobs'))).status).toBe(401);
    expect(backend).not.toHaveBeenCalled();
});

test('rejects caller-supplied identity', async () => {
    auth.mockResolvedValue({ user: { id: 'verified-user' } } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
    const response = await POST(request({ message: 'Build a workout', request_id: crypto.randomUUID(), user_id: 'someone-else' }));
    expect(response.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
});

test('rejects cross-origin and form-like submissions', async () => {
    const crossOrigin = new NextRequest('http://localhost/api/levelupos/jobs', {
        method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' }, body: '{}',
    });
    expect((await POST(crossOrigin)).status).toBe(403);
    const form = new NextRequest('http://localhost/api/levelupos/jobs', { method: 'POST', body: '{}' });
    expect((await POST(form)).status).toBe(415);
    expect(backend).not.toHaveBeenCalled();
});

test('injects verified identity and returns promptly with accepted job', async () => {
    auth.mockResolvedValue({ user: { id: 'verified-user' } } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
    backend.mockResolvedValue({ id: 'saved-job', status: 'queued' });
    const requestId = crypto.randomUUID();
    const response = await POST(request({ message: 'Build a workout', request_id: requestId }));
    expect(response.status).toBe(202);
    expect(backend).toHaveBeenCalledWith('jobs', {
        method: 'POST', body: JSON.stringify({ message: 'Build a workout', request_id: requestId, user_id: 'verified-user' }),
    });
    await GET(new NextRequest('http://localhost/api/levelupos/jobs?user_id=someone-else'));
    expect(backend).toHaveBeenLastCalledWith('jobs?user_id=verified-user');
});
