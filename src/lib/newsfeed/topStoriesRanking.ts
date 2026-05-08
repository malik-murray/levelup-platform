type TopicNameMap = Map<string, string>;

type SourceLike = {
    id: string;
    name: string;
    display_name: string;
};

type SummaryLike = {
    paragraphs_1?: string;
    paragraphs_2?: string;
    paragraphs_3?: string;
    paragraphs_4?: string;
    paragraphs_5?: string;
    why_it_matters?: string;
} | null;

export type RankableArticle = {
    id: string;
    title: string;
    description: string | null;
    publish_time: string;
    topic_ids: string[];
    source: SourceLike;
    summary: SummaryLike;
    user_action: {
        preferred_summary_length: number;
    };
};

export type RankedArticle<T extends RankableArticle> = {
    article: T;
    score: number;
    debug: {
        topic: number;
        needToKnow: number;
        urgency: number;
        recency: number;
        reliability: number;
        summaryQuality: number;
        noisePenalty: number;
    };
};

type RankingConfig = {
    topStoriesCount: number;
    maxPerSource: number;
    sourceReliability: Record<string, number>;
};

const DEFAULT_CONFIG: RankingConfig = {
    topStoriesCount: 5,
    maxPerSource: 2,
    sourceReliability: {
        reuters: 12,
        ap_news: 12,
        bloomberg: 11,
        npr: 10,
        marketwatch: 9,
        wsj: 11,
        financial_times: 11,
        the_verge: 8,
        techcrunch: 7,
        hacker_news: 6,
        wtop: 8,
        dcist: 7,
    },
};

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'new', 'after', 'amid', 'into', 'over', 'under',
    'about', 'says', 'say', 'are', 'is', 'was', 'were', 'has', 'have', 'had', 'you', 'your', 'their', 'its', 'our',
]);

function toText(article: RankableArticle): string {
    const summaryText = [
        article.summary?.paragraphs_1,
        article.summary?.paragraphs_2,
        article.summary?.paragraphs_3,
        article.summary?.why_it_matters,
        article.description,
    ]
        .filter(Boolean)
        .join(' ');
    return `${article.title} ${summaryText}`.toLowerCase();
}

function hasAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(keyword));
}

export function getTopicWeight(topicNames: Set<string>): number {
    let score = 0;
    if (topicNames.has('federal_workforce')) score += 32;
    if (topicNames.has('fed_gov')) score += 28;
    if (topicNames.has('dmv')) score += 24;
    if (topicNames.has('tech') || topicNames.has('ai') || topicNames.has('software')) score += 18;
    if (topicNames.has('finance') || topicNames.has('stocks') || topicNames.has('economy')) score += 16;
    if (topicNames.has('business')) score += 12;
    return score;
}

export function getNeedToKnowScore(article: RankableArticle, topicNames: Set<string>): number {
    const text = toText(article);
    let score = 0;

    if (hasAny(text, ['your job', 'employment', 'payroll', 'benefits', 'clearance', 'hiring freeze', 'layoff'])) score += 10;
    if (hasAny(text, ['tax', 'inflation', 'interest rate', 'mortgage', 'retirement', '401k', 'market volatility'])) score += 8;
    if (hasAny(text, ['dmv', 'local government', 'county', 'city services', 'public transit'])) score += 7;
    if (hasAny(text, ['federal agency', 'executive order', 'regulation', 'compliance', 'government services'])) score += 8;
    if (hasAny(text, ['emergency', 'security alert', 'cyberattack', 'public safety', 'rights', 'legal ruling'])) score += 9;
    if (hasAny(text, ['ai', 'chip', 'cloud', 'platform shift', 'market shift', 'policy shift'])) score += 6;

    if (topicNames.has('federal_workforce') || topicNames.has('fed_gov')) score += 6;
    if (topicNames.has('dmv')) score += 4;
    if (topicNames.has('finance')) score += 4;

    return score;
}

export function getUrgencyScore(article: RankableArticle): number {
    const text = toText(article);
    let score = 0;

    if (hasAny(text, ['deadline', 'due by', 'effective immediately', 'urgent', 'now in effect'])) score += 12;
    if (hasAny(text, ['layoff', 'cuts', 'shutdown', 'recall', 'outage', 'breach', 'emergency'])) score += 10;
    if (hasAny(text, ['policy change', 'new rule', 'final rule', 'guidance update', 'court ruling'])) score += 9;
    if (hasAny(text, ['action required', 'what you should do', 'steps to take'])) score += 7;

    return score;
}

export function getRecencyScore(publishTime: string): number {
    const ageHours = Math.max(0, (Date.now() - new Date(publishTime).getTime()) / 3600000);
    if (ageHours <= 6) return 12;
    if (ageHours <= 12) return 10;
    if (ageHours <= 24) return 8;
    if (ageHours <= 48) return 5;
    if (ageHours <= 72) return 3;
    return 1;
}

export function getSourceReliabilityScore(sourceName: string, config: RankingConfig = DEFAULT_CONFIG): number {
    return config.sourceReliability[sourceName] ?? 5;
}

export function getSummaryQualityScore(article: RankableArticle): number {
    const preferredLength = article.user_action.preferred_summary_length || 1;
    const summaryText =
        (article.summary?.[`paragraphs_${preferredLength}` as keyof NonNullable<SummaryLike>] as string) ||
        article.summary?.paragraphs_1 ||
        article.description ||
        '';
    const whyItMatters = article.summary?.why_it_matters || '';

    let score = 0;
    if (summaryText.trim().length >= 80) score += 5;
    if (summaryText.trim().length >= 160) score += 2;
    if (whyItMatters.trim().length >= 30) score += 6;
    if (hasAny(`${summaryText} ${whyItMatters}`.toLowerCase(), ['what to do', 'next steps', 'action', 'impact'])) score += 4;

    return score;
}

export function getNoisePenalty(article: RankableArticle, topicNames: Set<string>): number {
    const text = toText(article);
    let penalty = 0;

    if (hasAny(text, ['celebrity', 'viral', 'gossip', 'rumor', 'entertainment', 'lifestyle'])) penalty += 12;
    if (hasAny(text, ['opinion', 'editorial', 'commentary'])) penalty += 8;
    if (!article.summary?.paragraphs_1 && !article.description) penalty += 6;
    if (!article.summary?.why_it_matters) penalty += 4;
    if (topicNames.size === 0) penalty += 5;

    return penalty;
}

function getTopicNames(article: RankableArticle, topicIdToName: TopicNameMap): Set<string> {
    return new Set(article.topic_ids.map((topicId) => topicIdToName.get(topicId)).filter(Boolean) as string[]);
}

function getEventClusterKey(article: RankableArticle): string {
    const tokens = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 3 && !STOPWORDS.has(token))
        .slice(0, 8);
    return Array.from(new Set(tokens)).slice(0, 4).join('-') || article.id;
}

function scoreArticle<T extends RankableArticle>(article: T, topicIdToName: TopicNameMap, config: RankingConfig): RankedArticle<T> {
    const topicNames = getTopicNames(article, topicIdToName);
    const topic = getTopicWeight(topicNames);
    const needToKnow = getNeedToKnowScore(article, topicNames);
    const urgency = getUrgencyScore(article);
    const recency = getRecencyScore(article.publish_time);
    const reliability = getSourceReliabilityScore(article.source.name, config);
    const summaryQuality = getSummaryQualityScore(article);
    const noisePenalty = getNoisePenalty(article, topicNames);

    const score = topic + needToKnow + urgency + recency + reliability + summaryQuality - noisePenalty;

    return {
        article,
        score,
        debug: { topic, needToKnow, urgency, recency, reliability, summaryQuality, noisePenalty },
    };
}

function deduplicateByEvent<T extends RankableArticle>(ranked: RankedArticle<T>[]): RankedArticle<T>[] {
    const bestByCluster = new Map<string, RankedArticle<T>>();
    for (const item of ranked) {
        const key = getEventClusterKey(item.article);
        const current = bestByCluster.get(key);
        if (!current || item.score > current.score) {
            bestByCluster.set(key, item);
        }
    }
    return Array.from(bestByCluster.values()).sort((a, b) => b.score - a.score);
}

function selectDiversifiedTopStories<T extends RankableArticle>(
    rankedDeduped: RankedArticle<T>[],
    count: number,
    maxPerSource: number,
): T[] {
    const selected: T[] = [];
    const sourceCounts = new Map<string, number>();

    for (const item of rankedDeduped) {
        if (selected.length >= count) break;
        const sourceId = item.article.source.id;
        const seen = sourceCounts.get(sourceId) ?? 0;
        if (seen >= 1) continue;
        selected.push(item.article);
        sourceCounts.set(sourceId, seen + 1);
    }

    for (const item of rankedDeduped) {
        if (selected.length >= count) break;
        if (selected.some((s) => s.id === item.article.id)) continue;
        const sourceId = item.article.source.id;
        const seen = sourceCounts.get(sourceId) ?? 0;
        if (seen >= maxPerSource) continue;
        selected.push(item.article);
        sourceCounts.set(sourceId, seen + 1);
    }

    return selected;
}

export function rankArticlesForBriefing<T extends RankableArticle>(
    articles: T[],
    topicIdToName: TopicNameMap,
    overrides?: Partial<RankingConfig>,
) {
    const config: RankingConfig = {
        ...DEFAULT_CONFIG,
        ...overrides,
        sourceReliability: {
            ...DEFAULT_CONFIG.sourceReliability,
            ...(overrides?.sourceReliability || {}),
        },
    };

    const ranked = articles
        .map((article) => scoreArticle(article, topicIdToName, config))
        .sort((a, b) => b.score - a.score);

    const deduped = deduplicateByEvent(ranked);
    const topStories = selectDiversifiedTopStories(deduped, config.topStoriesCount, config.maxPerSource);

    return {
        rankedArticles: deduped.map((item) => item.article),
        topStories,
        scoredArticles: deduped,
    };
}
