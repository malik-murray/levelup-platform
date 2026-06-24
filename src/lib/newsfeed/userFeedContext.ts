export type UserFeedContext = {
    role_job_context: string | null;
    interests: string[];
    goals: string[];
};

export const EMPTY_USER_FEED_CONTEXT: UserFeedContext = {
    role_job_context: null,
    interests: [],
    goals: [],
};

export const INTEREST_SUGGESTIONS = [
    'federal workforce',
    'DMV / local news',
    'tech',
    'AI',
    'finance',
    'real estate',
    'health',
    'politics',
    'career growth',
    'parenting',
] as const;

export const GOAL_SUGGESTIONS = [
    'career growth',
    'financial growth',
    'job security',
    'stay informed on policy',
    'local community',
    'family wellbeing',
] as const;

const ROLE_PATTERN_BOOSTS: Array<{ pattern: RegExp; keywords: string[]; score: number }> = [
    { pattern: /federal|government|fed gov|public sector|civil service/i, keywords: ['federal', 'government', 'agency', 'executive order', 'clearance', 'gs pay'], score: 12 },
    { pattern: /dmv|washington dc|northern virginia|maryland|local government/i, keywords: ['dmv', 'metro', 'county', 'city council', 'local government', 'arlington', 'montgomery'], score: 10 },
    { pattern: /tech|software|engineer|developer|ai/i, keywords: ['ai', 'software', 'cloud', 'startup', 'chip', 'automation', 'cyber'], score: 10 },
    { pattern: /finance|invest|bank|accounting/i, keywords: ['market', 'stocks', 'inflation', 'interest rate', '401k', 'mortgage', 'fed rate'], score: 10 },
    { pattern: /business|entrepreneur|founder/i, keywords: ['business', 'startup', 'revenue', 'hiring', 'layoff', 'economy'], score: 8 },
];

const INTEREST_TOPIC_MAP: Record<string, string[]> = {
    'federal workforce': ['federal_workforce', 'fed_gov'],
    'dmv / local news': ['dmv'],
    tech: ['tech', 'ai', 'software'],
    ai: ['ai', 'tech'],
    finance: ['finance', 'stocks', 'economy'],
    'real estate': ['real_estate'],
    health: ['health'],
    politics: ['fed_gov', 'politics'],
};

function tokenizePhrase(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2);
}

export function normalizeUserFeedContext(input?: Partial<UserFeedContext> | null): UserFeedContext {
    const interests = Array.isArray(input?.interests)
        ? input.interests.map((item) => String(item).trim()).filter(Boolean)
        : [];
    const goals = Array.isArray(input?.goals)
        ? input.goals.map((item) => String(item).trim()).filter(Boolean)
        : [];
    const role = typeof input?.role_job_context === 'string' ? input.role_job_context.trim() : '';

    return {
        role_job_context: role || null,
        interests: Array.from(new Set(interests)),
        goals: Array.from(new Set(goals)),
    };
}

export function hasUserFeedContext(context: UserFeedContext | null | undefined): boolean {
    if (!context) return false;
    return Boolean(context.role_job_context) || context.interests.length > 0 || context.goals.length > 0;
}

export function formatUserContextForPrompt(context: UserFeedContext | null | undefined): string {
    const normalized = normalizeUserFeedContext(context);
    if (!hasUserFeedContext(normalized)) {
        return 'No reader profile provided. Score personal relevance using general civic and economic impact.';
    }

    const lines = [
        `Role / job context: ${normalized.role_job_context || 'Not specified'}`,
        `Interests: ${normalized.interests.length > 0 ? normalized.interests.join(', ') : 'Not specified'}`,
        `Goals: ${normalized.goals.length > 0 ? normalized.goals.join(', ') : 'Not specified'}`,
        'Tailor why_it_matters and user_action to this reader. Boost personal_relevance_score when the story clearly affects their role, interests, or goals.',
    ];
    return lines.join('\n');
}

function hasKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
}

export function getPersonalRelevanceScore(
    articleText: string,
    topicNames: Set<string>,
    context: UserFeedContext | null | undefined,
): number {
    const normalized = normalizeUserFeedContext(context);
    if (!hasUserFeedContext(normalized)) return 0;

    const text = articleText.toLowerCase();
    let score = 0;

    if (normalized.role_job_context) {
        for (const { pattern, keywords, score: boost } of ROLE_PATTERN_BOOSTS) {
            if (pattern.test(normalized.role_job_context) && hasKeyword(text, keywords)) {
                score += boost;
            }
        }
        for (const token of tokenizePhrase(normalized.role_job_context)) {
            if (text.includes(token)) {
                score += 6;
            }
        }
    }

    for (const interest of normalized.interests) {
        const interestLower = interest.toLowerCase();
        if (interestLower.length > 2 && text.includes(interestLower)) {
            score += 10;
        }
        const mappedTopics = INTEREST_TOPIC_MAP[interestLower] || INTEREST_TOPIC_MAP[interest] || [];
        if (mappedTopics.some((topic) => topicNames.has(topic))) {
            score += 8;
        }
        for (const token of tokenizePhrase(interest)) {
            if (text.includes(token)) {
                score += 4;
            }
        }
    }

    for (const goal of normalized.goals) {
        const goalLower = goal.toLowerCase();
        if (goalLower.length > 2 && text.includes(goalLower)) {
            score += 8;
        }
        for (const token of tokenizePhrase(goal)) {
            if (text.includes(token)) {
                score += 5;
            }
        }
    }

    return Math.min(score, 42);
}
