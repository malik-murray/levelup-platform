import {
    formatUserContextForPrompt,
    getPersonalRelevanceScore,
    hasUserFeedContext,
    normalizeUserFeedContext,
} from '@/lib/newsfeed/userFeedContext';

const EMPTY_CONTEXT = normalizeUserFeedContext(null);

describe('userFeedContext', () => {
    it('normalizes arrays and trims role text', () => {
        expect(
            normalizeUserFeedContext({
                role_job_context: '  Federal analyst  ',
                interests: [' tech ', 'tech', ''],
                goals: ['career growth'],
            }),
        ).toEqual({
            role_job_context: 'Federal analyst',
            interests: ['tech'],
            goals: ['career growth'],
        });
    });

    it('detects meaningful context', () => {
        expect(hasUserFeedContext(EMPTY_CONTEXT)).toBe(false);
        expect(hasUserFeedContext({ role_job_context: 'Engineer', interests: [], goals: [] })).toBe(true);
    });

    it('scores articles that match reader interests', () => {
        const score = getPersonalRelevanceScore(
            'Federal agency announces hiring freeze and clearance review changes',
            new Set(['federal_workforce']),
            {
                role_job_context: 'Federal employee',
                interests: ['federal workforce'],
                goals: ['job security'],
            },
        );
        expect(score).toBeGreaterThan(15);
    });

    it('formats prompt context for LangGraph', () => {
        const prompt = formatUserContextForPrompt({
            role_job_context: 'Software engineer',
            interests: ['tech', 'AI'],
            goals: ['career growth'],
        });
        expect(prompt).toContain('Software engineer');
        expect(prompt).toContain('tech, AI');
    });
});
