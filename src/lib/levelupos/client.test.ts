import { agentBackend, AgentBackendError } from './client';

const oldEnv = process.env;
beforeEach(() => {
    process.env = { ...oldEnv, LEVELUPOS_AGENTOS_URL: 'https://agents.example', LEVELUPOS_AGENTOS_KEY: 'private-key' };
    global.fetch = jest.fn();
});
afterEach(() => { process.env = oldEnv; jest.restoreAllMocks(); });

test('adds server credentials and disables caching and redirects', async () => {
    jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ jobs: [] })));
    await agentBackend('jobs?user_id=verified');
    expect(fetch).toHaveBeenCalledWith('https://agents.example/levelupos/jobs?user_id=verified', expect.objectContaining({
        cache: 'no-store', redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer private-key' }),
    }));
});

test('does not forward upstream errors or secrets', async () => {
    jest.mocked(fetch).mockResolvedValue(new Response('sensitive traceback private-key', { status: 500 }));
    await expect(agentBackend('jobs')).rejects.toThrow('Agent backend returned an error.');
});

test('refuses insecure production configuration and missing configuration', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', LEVELUPOS_AGENTOS_URL: 'http://agents.example' };
    await expect(agentBackend('jobs')).rejects.toBeInstanceOf(AgentBackendError);
    delete process.env.LEVELUPOS_AGENTOS_KEY;
    await expect(agentBackend('jobs')).rejects.toThrow('not connected');
    expect(fetch).not.toHaveBeenCalled();
});
