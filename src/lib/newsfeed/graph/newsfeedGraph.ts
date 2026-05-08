import { createClient } from '@supabase/supabase-js';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ingestArticlesFromSources } from '@/lib/newsfeed/articleIngestion';
import { APPROVED_SOURCE_REGISTRY, SourceRegistryEntry } from '@/lib/newsfeed/sourceRegistry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const analysisSchema = z.object({
    topic: z.string().min(2),
    importance_score: z.number().min(0).max(100),
    urgency_score: z.number().min(0).max(100),
    personal_relevance_score: z.number().min(0).max(100),
    location_relevance_score: z.number().min(0).max(100),
    need_to_know_score: z.number().min(0).max(100),
    why_it_matters: z.string().min(15),
    user_action: z.string().min(2),
    noise_penalty: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
});

type CandidateArticle = {
    id: string;
    title: string;
    url: string;
    description: string | null;
    publish_time: string;
    source_id: string;
    source: {
        id: string;
        name: string;
        display_name: string;
        domain: string | null;
        category: string | null;
        region: string | null;
        reliability_score: number | null;
        priority_weight: number | null;
        is_active: boolean;
    } | null;
};

type RawCandidateRow = {
    id: string;
    title: string;
    url: string;
    description: string | null;
    publish_time: string;
    source_id: string;
    newsfeed_sources: CandidateArticle['source'] | CandidateArticle['source'][];
};

type GeneratedAnalysis = {
    article_id: string;
    source_id: string | null;
    topic: string;
    category: string;
    importance_score: number;
    urgency_score: number;
    personal_relevance_score: number;
    location_relevance_score: number;
    need_to_know_score: number;
    noise_penalty: number;
    final_score: number;
    why_it_matters: string;
    user_action: string;
    cluster_key: string;
    is_whitelisted: boolean;
    is_duplicate: boolean;
    model_name: string;
    model_confidence: number;
    analysis_json: Record<string, unknown>;
    rank_position: number;
};

const NewsfeedGraphState = Annotation.Root({
    sourceIds: Annotation<string[] | undefined>({
        reducer: (_, update) => update,
        default: () => undefined,
    }),
    maxArticles: Annotation<number>({
        reducer: (_, update) => update ?? 20,
        default: () => 20,
    }),
    lookbackHours: Annotation<number>({
        reducer: (_, update) => update ?? 36,
        default: () => 36,
    }),
    fetchedCount: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    insertedCount: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    sourcesProcessedCount: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    exactTopicAssignments: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    fallbackTopicAssignments: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    failedBatches: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    inactiveFeeds: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    registrySyncedCount: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    candidates: Annotation<CandidateArticle[]>({
        reducer: (_, update) => update ?? [],
        default: () => [],
    }),
    analyzed: Annotation<GeneratedAnalysis[]>({
        reducer: (_, update) => update ?? [],
        default: () => [],
    }),
    persistedCount: Annotation<number>({
        reducer: (_, update) => update ?? 0,
        default: () => 0,
    }),
    errors: Annotation<string[]>({
        reducer: (current, update) => current.concat(update ?? []),
        default: () => [],
    }),
});

type NewsfeedGraphStateType = typeof NewsfeedGraphState.State;

async function syncSourceRegistryNode() {
    const payload = APPROVED_SOURCE_REGISTRY.map((source) => ({
        name: source.name,
        display_name: source.display_name,
        url: source.url,
        domain: source.domain,
        category: source.category,
        region: source.region,
        rss_url: source.rss_url,
        rss_feed_url: source.rss_url,
        reliability_score: source.reliability_score,
        priority_weight: source.priority_weight,
        is_active: source.is_active && Boolean(source.rss_url),
        feed_status: source.rss_url ? 'active' : 'no_feed',
        updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
        .from('newsfeed_sources')
        .upsert(payload, { onConflict: 'name', ignoreDuplicates: false })
        .select('id');

    if (error) {
        return { errors: [`Failed syncing source registry: ${error.message}`] };
    }
    return { registrySyncedCount: data?.length || 0 };
}

async function ingestNode(state: NewsfeedGraphStateType) {
    try {
        const result = await ingestArticlesFromSources(state.sourceIds);
        return {
            sourcesProcessedCount: result.sourcesProcessed,
            fetchedCount: result.totalArticlesFetched,
            insertedCount: result.totalArticlesInserted,
            exactTopicAssignments: result.exactTopicAssignments,
            fallbackTopicAssignments: result.fallbackTopicAssignments,
            failedBatches: result.failedBatches,
            inactiveFeeds: result.inactiveFeeds,
            errors: result.errors,
        };
    } catch (error) {
        return {
            errors: [error instanceof Error ? error.message : 'Ingestion failed'],
        };
    }
}

async function selectCandidatesNode(state: NewsfeedGraphStateType) {
    const since = new Date();
    since.setHours(since.getHours() - state.lookbackHours);

    const { data: articles, error } = await supabase
        .from('newsfeed_articles')
        .select(`
            id,
            title,
            url,
            description,
            publish_time,
            source_id,
            newsfeed_sources(
                id,
                name,
                display_name,
                domain,
                category,
                region,
                reliability_score,
                priority_weight,
                is_active
            )
        `)
        .gte('publish_time', since.toISOString())
        .order('publish_time', { ascending: false })
        .limit(Math.max(state.maxArticles * 5, 40));

    if (error) {
        return { errors: [`Failed selecting candidate articles: ${error.message}`] };
    }

    const candidates = ((articles || []) as RawCandidateRow[]).map((article) => ({
        id: article.id,
        title: article.title,
        url: article.url,
        description: article.description,
        publish_time: article.publish_time,
        source_id: article.source_id,
        source: Array.isArray(article.newsfeed_sources) ? article.newsfeed_sources[0] : article.newsfeed_sources,
    })) as CandidateArticle[];
    if (candidates.length === 0) {
        return { candidates: [] };
    }

    return { candidates: candidates.slice(0, state.maxArticles) };
}

const LOCATION_TERMS = [
    'alexandria', 'fairfax', 'washington dc', 'dc', 'montgomery county',
    "prince george's county", 'prince georges county', 'arlington',
    'reston', 'northern virginia', 'maryland', 'virginia',
];

function getHostname(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

function domainMatches(hostname: string | null, sourceDomain: string | null | undefined): boolean {
    if (!hostname || !sourceDomain) return false;
    const normalizedDomain = sourceDomain.toLowerCase().replace(/^www\./, '');
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

function getClusterKey(article: CandidateArticle): string {
    const parts = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 3)
        .slice(0, 6);
    return parts.slice(0, 4).join('-') || article.id;
}

function heuristicAnalysis(article: CandidateArticle, sourceConfig: SourceRegistryEntry | undefined) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    const importance = /federal|government|policy|security|market|inflation|rate|layoff|housing|dmv/.test(text) ? 75 : 45;
    const urgency = /deadline|emergency|layoff|warning|immediate|outage/.test(text) ? 70 : 35;
    const personal = /job|salary|benefits|tax|mortgage|retirement/.test(text) ? 72 : 40;
    const location = LOCATION_TERMS.some((term) => text.includes(term)) ? 78 : 28;
    const need = /rights|safety|services|government|market|housing|ai|automation/.test(text) ? 74 : 38;
    const noisePenalty = /gossip|celebrity|viral|rumor|opinion/.test(text) ? 40 : 8;
    const reliabilityBoost = (sourceConfig?.reliability_score ?? 0.7) * 20;
    const priorityBoost = (sourceConfig?.priority_weight ?? 1) * 8;
    const finalScore = importance * 0.24 + urgency * 0.18 + personal * 0.16 + location * 0.12 + need * 0.2 + reliabilityBoost + priorityBoost - noisePenalty * 0.2;

    return {
        topic: sourceConfig?.category || 'general',
        importance_score: importance,
        urgency_score: urgency,
        personal_relevance_score: personal,
        location_relevance_score: location,
        need_to_know_score: need,
        why_it_matters: 'This story may impact policy, decisions, or local conditions relevant to your daily priorities.',
        user_action: urgency > 60 ? 'Monitor this closely and review official guidance.' : 'Keep informed; no immediate action required.',
        noise_penalty: noisePenalty,
        confidence: 0.6,
        finalScore,
    };
}

async function analyzeWithRetry(article: CandidateArticle, sourceConfig: SourceRegistryEntry | undefined, retries = 1) {
    const model = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        timeout: 30000,
    });
    const structuredModel = model.withStructuredOutput(analysisSchema);
    const prompt = `
You are a high-signal news analyst. Return only JSON matching schema.
Prioritize need-to-know over trending content.
Focus on: job impact, money impact, federal/DMV/public service impact, rights/safety, major tech or market shifts.
Penalize gossip, rumor, celebrity, opinion-only, and low-information content.

Article title: ${article.title}
Article description: ${article.description || 'No description provided.'}
Source category: ${sourceConfig?.category || 'unknown'}
Source region: ${sourceConfig?.region || 'unknown'}

Use short, actionable "why_it_matters" and "user_action".
`.trim();

    let lastError: string | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const analysis = await structuredModel.invoke(prompt);
            if (analysis.confidence < 0.5) {
                throw new Error(`Analysis confidence too low (${analysis.confidence})`);
            }
            const reliabilityBoost = (sourceConfig?.reliability_score ?? 0.7) * 20;
            const priorityBoost = (sourceConfig?.priority_weight ?? 1) * 8;
            const finalScore =
                analysis.importance_score * 0.24 +
                analysis.urgency_score * 0.18 +
                analysis.personal_relevance_score * 0.16 +
                analysis.location_relevance_score * 0.12 +
                analysis.need_to_know_score * 0.2 +
                reliabilityBoost +
                priorityBoost -
                analysis.noise_penalty * 0.2;

            return { ...analysis, finalScore };
        } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown summarization error';
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
            }
        }
    }

    throw new Error(lastError || `Failed analyzing article ${article.id}`);
}

function selectDiversified(articles: GeneratedAnalysis[], limit: number) {
    const selected: GeneratedAnalysis[] = [];
    const sourceCounts = new Map<string, number>();
    const usedClusters = new Set<string>();

    for (const article of articles) {
        if (selected.length >= limit) break;
        if (usedClusters.has(article.cluster_key)) continue;
        const sourceId = article.source_id || 'unknown';
        const count = sourceCounts.get(sourceId) || 0;
        if (count > 0) continue;
        selected.push(article);
        sourceCounts.set(sourceId, count + 1);
        usedClusters.add(article.cluster_key);
    }
    for (const article of articles) {
        if (selected.length >= limit) break;
        if (selected.some((item) => item.article_id === article.article_id)) continue;
        if (usedClusters.has(article.cluster_key)) continue;
        const sourceId = article.source_id || 'unknown';
        const count = sourceCounts.get(sourceId) || 0;
        if (count >= 2) continue;
        selected.push(article);
        sourceCounts.set(sourceId, count + 1);
        usedClusters.add(article.cluster_key);
    }
    return selected;
}

async function analyzeNode(state: NewsfeedGraphStateType) {
    if (state.candidates.length === 0) {
        return { analyzed: [] };
    }

    const registryByName = new Map(APPROVED_SOURCE_REGISTRY.map((source) => [source.name, source]));

    const analyzed: GeneratedAnalysis[] = [];
    const errors: string[] = [];

    for (const article of state.candidates) {
        try {
            const sourceName = article.source?.name || '';
            const sourceConfig = registryByName.get(sourceName);
            const host = getHostname(article.url);
            const isWhitelisted = Boolean(sourceConfig && article.source?.is_active && domainMatches(host, sourceConfig.domain));
            if (!isWhitelisted) {
                continue;
            }

            let analysisResult:
                | ReturnType<typeof heuristicAnalysis>
                | (z.infer<typeof analysisSchema> & { finalScore: number });
            if (!process.env.OPENAI_API_KEY) {
                analysisResult = heuristicAnalysis(article, sourceConfig);
            } else {
                try {
                    analysisResult = await analyzeWithRetry(article, sourceConfig);
                } catch {
                    analysisResult = heuristicAnalysis(article, sourceConfig);
                }
            }

            analyzed.push({
                article_id: article.id,
                source_id: article.source_id || null,
                topic: analysisResult.topic,
                category: sourceConfig?.category || article.source?.category || 'national_news',
                importance_score: analysisResult.importance_score,
                urgency_score: analysisResult.urgency_score,
                personal_relevance_score: analysisResult.personal_relevance_score,
                location_relevance_score: analysisResult.location_relevance_score,
                need_to_know_score: analysisResult.need_to_know_score,
                noise_penalty: analysisResult.noise_penalty,
                final_score: analysisResult.finalScore,
                why_it_matters: analysisResult.why_it_matters,
                user_action: analysisResult.user_action,
                cluster_key: getClusterKey(article),
                is_whitelisted: true,
                is_duplicate: false,
                model_name: process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'heuristic',
                model_confidence: analysisResult.confidence,
                analysis_json: analysisResult,
                rank_position: 0,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown analysis error';
            errors.push(`Article ${article.id}: ${msg}`);
        }
    }

    const bestByCluster = new Map<string, GeneratedAnalysis>();
    for (const item of analyzed.sort((a, b) => b.final_score - a.final_score)) {
        const existing = bestByCluster.get(item.cluster_key);
        if (!existing) {
            bestByCluster.set(item.cluster_key, item);
            continue;
        }
        item.is_duplicate = true;
    }

    const deduped = Array.from(bestByCluster.values()).sort((a, b) => b.final_score - a.final_score);
    const topStories = selectDiversified(deduped, Math.max(state.maxArticles, 20));
    topStories.forEach((item, index) => {
        item.rank_position = index + 1;
    });

    return { analyzed: topStories, errors };
}

async function persistNode(state: NewsfeedGraphStateType) {
    if (state.analyzed.length === 0) {
        return { persistedCount: 0 };
    }

    const analysisPayload = state.analyzed.map((item) => ({
        article_id: item.article_id,
        source_id: item.source_id,
        topic: item.topic,
        category: item.category,
        importance_score: item.importance_score,
        urgency_score: item.urgency_score,
        personal_relevance_score: item.personal_relevance_score,
        location_relevance_score: item.location_relevance_score,
        need_to_know_score: item.need_to_know_score,
        noise_penalty: item.noise_penalty,
        final_score: item.final_score,
        why_it_matters: item.why_it_matters,
        user_action: item.user_action,
        cluster_key: item.cluster_key,
        is_whitelisted: item.is_whitelisted,
        is_duplicate: item.is_duplicate,
        model_name: item.model_name,
        model_confidence: item.model_confidence,
        analysis_json: item.analysis_json,
        updated_at: new Date().toISOString(),
    }));

    const rankingPayload = state.analyzed.map((item) => ({
        article_id: item.article_id,
        rank_position: item.rank_position,
        final_score: item.final_score,
        source_id: item.source_id,
        cluster_key: item.cluster_key,
        updated_at: new Date().toISOString(),
    }));

    const [{ data: analysisRows, error: analysisError }, { error: deleteError }, { data: rankingRows, error: rankingError }] = await Promise.all([
        supabase
            .from('newsfeed_article_analysis')
            .upsert(analysisPayload, { onConflict: 'article_id', ignoreDuplicates: false })
            .select('article_id'),
        supabase.from('newsfeed_top_story_rankings').delete().gte('rank_position', 1),
        supabase
            .from('newsfeed_top_story_rankings')
            .upsert(rankingPayload, { onConflict: 'article_id', ignoreDuplicates: false })
            .select('article_id'),
    ]);

    if (analysisError || rankingError || deleteError) {
        return {
            errors: [
                analysisError ? `Failed persisting analysis: ${analysisError.message}` : '',
                deleteError ? `Failed refreshing ranking table: ${deleteError.message}` : '',
                rankingError ? `Failed persisting rankings: ${rankingError.message}` : '',
            ].filter(Boolean),
        };
    }

    return { persistedCount: Math.max(analysisRows?.length || 0, rankingRows?.length || 0) };
}

function shouldAnalyze(state: NewsfeedGraphStateType) {
    if (state.candidates.length === 0) {
        return 'end';
    }

    return 'analyze';
}

const graph = new StateGraph(NewsfeedGraphState)
    .addNode('syncRegistry', syncSourceRegistryNode)
    .addNode('ingest', ingestNode)
    .addNode('selectCandidates', selectCandidatesNode)
    .addNode('analyze', analyzeNode)
    .addNode('persist', persistNode)
    .addEdge(START, 'syncRegistry')
    .addEdge('syncRegistry', 'ingest')
    .addEdge('ingest', 'selectCandidates')
    .addConditionalEdges('selectCandidates', shouldAnalyze, {
        analyze: 'analyze',
        end: END,
    })
    .addEdge('analyze', 'persist')
    .addEdge('persist', END)
    .compile();

export async function runNewsfeedGraph(input?: {
    sourceIds?: string[];
    maxArticles?: number;
    lookbackHours?: number;
}) {
    const result = await graph.invoke({
        sourceIds: input?.sourceIds,
        maxArticles: input?.maxArticles ?? 20,
        lookbackHours: input?.lookbackHours ?? 36,
    });

    return {
        registrySyncedCount: result.registrySyncedCount,
        sourcesProcessedCount: result.sourcesProcessedCount,
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        exactTopicAssignments: result.exactTopicAssignments,
        fallbackTopicAssignments: result.fallbackTopicAssignments,
        failedBatches: result.failedBatches,
        inactiveFeeds: result.inactiveFeeds,
        candidateCount: result.candidates.length,
        analyzedCount: result.analyzed.length,
        persistedCount: result.persistedCount,
        errors: result.errors,
    };
}
