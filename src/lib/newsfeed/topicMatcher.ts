/**
 * Topic Matcher
 * Matches articles to topics based on keywords in title and description
 */

export interface TopicMatch {
    topicId: string;
    topicName: string;
    confidence: number;
}

/**
 * Topic keyword mappings
 * Maps topic names to arrays of keywords that indicate a match
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
    // Technology
    'tech': ['technology', 'tech', 'software', 'app', 'digital', 'internet', 'web', 'online', 'platform', 'system', 'device', 'computer', 'laptop', 'smartphone', 'tablet', 'gadget'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural network', 'deep learning', 'chatgpt', 'openai', 'llm', 'gpt', 'claude', 'generative ai', 'automation', 'robot', 'robotics'],
    'crypto': ['crypto', 'cryptocurrency', 'bitcoin', 'btc', 'ethereum', 'eth', 'blockchain', 'nft', 'defi', 'web3', 'crypto market', 'digital currency', 'altcoin', 'token'],
    'software': ['software', 'code', 'programming', 'developer', 'coding', 'api', 'sdk', 'framework', 'library', 'github', 'git', 'open source'],
    'hardware': ['hardware', 'chip', 'processor', 'cpu', 'gpu', 'semiconductor', 'intel', 'amd', 'nvidia', 'apple silicon', 'qualcomm'],
    'startups': ['startup', 'unicorn', 'ipo', 'venture capital', 'vc', 'funding', 'raise', 'seed round', 'series a', 'series b', 'y combinator'],
    
    // Business & Finance
    'business': ['business', 'company', 'corporate', 'enterprise', 'firm', 'organization', 'merger', 'acquisition', 'deal', 'partnership'],
    'economy': [
        'economy', 'economic', 'gdp', 'inflation', 'recession', 'growth', 'market', 'trade', 'commerce', 'economic policy',
        'tariff', 'tariffs', 'deficit', 'fiscal deficit', 'federal debt', 'debt ceiling', 'bonds', 'treasury yields',
        'dollar', 'dxy', 'investing', 'markets', 'commodities', 'interest rates', 'jerome powell', 'federal reserve',
        'supply shock', 'supply shocks', 'big mac index',
    ],
    'finance': ['finance', 'financial', 'bank', 'banking', 'investment', 'investor', 'portfolio', 'asset', 'capital', 'revenue', 'profit', 'earnings'],
    'stocks': ['stock', 'stocks', 'equity', 'share', 'shares', 'nasdaq', 's&p', 'dow jones', 'trading', 'trader', 'market cap', 'valuation'],
    'crypto_markets': ['crypto market', 'bitcoin price', 'ethereum price', 'crypto trading', 'crypto exchange', 'binance', 'coinbase'],
    
    // Science & Health
    'science': [
        'science', 'scientific', 'research', 'study', 'discovery', 'experiment', 'laboratory', 'lab', 'scientist',
        'research paper', 'peer reviewed', 'breakthrough', 'genomics', 'biotech', 'climate science',
    ],
    'health': ['health', 'healthcare', 'medical', 'medicine', 'hospital', 'doctor', 'patient', 'treatment', 'therapy', 'disease', 'illness'],
    'medicine': ['medicine', 'drug', 'pharmaceutical', 'vaccine', 'treatment', 'clinical trial', 'fda', 'medical research'],
    'climate': ['climate', 'climate change', 'global warming', 'carbon', 'emissions', 'renewable', 'solar', 'wind energy', 'green', 'environment', 'environmental'],
    'space': ['space', 'nasa', 'astronaut', 'rocket', 'satellite', 'mars', 'moon', 'planet', 'galaxy', 'spacex', 'space exploration'],
    
    // World & Politics
    'world': ['world', 'global', 'international', 'nation', 'country', 'world news', 'global news'],
    'politics': [
        'politics', 'political', 'politician', 'election', 'vote', 'voting', 'campaign', 'senate', 'congress', 'parliament',
        'cabinet', 'nomination', 'nominee', 'confirmation hearing', 'legislation', 'bill passed', 'executive order',
    ],
    'fed_gov': [
        'federal', 'government', 'white house', 'president', 'congress', 'senate', 'house of representatives',
        'federal government', 'washington', 'dc', 'opm', 'omb', 'executive order', 'federal agency', 'appropriations',
        'government shutdown', 'civil service', 'usda', 'dhs', 'cisa', 'nrc', 'agency', 'federal employees',
        'government services', 'relocation', 'relocations', 'nominations',
    ],
    'federal_workforce': [
        'federal employee', 'federal workforce', 'federal workers', 'gs pay', 'pay raise', 'opm', 'telework',
        'return to office', 'remote work policy', 'government shutdown', 'civil service', 'furlough',
        'thrift savings plan', 'tsp', 'ses', 'excepted service',
    ],
    'dmv': [
        'dmv', 'district of columbia', 'washington dc', 'northern virginia', 'nova', 'maryland', 'virginia',
        'wmata', 'metro', 'mta maryland', 'montgomery county', 'prince georges county', 'fairfax county', 'arlington',
        'alexandria', 'reston', 'prince george', 'pg county',
    ],
    'elections': ['election', 'elections', 'vote', 'voting', 'ballot', 'primary', 'caucus', 'candidate', 'poll', 'polls'],
    'international': ['international', 'diplomacy', 'foreign policy', 'embassy', 'ambassador', 'trade war', 'sanctions'],
    
    // Society & Culture
    'culture': ['culture', 'cultural', 'society', 'social', 'community', 'tradition', 'heritage'],
    'sports': [
        'sports', 'sport', 'football', 'basketball', 'soccer', 'baseball', 'nfl', 'nba', 'mlb', 'olympics', 'athlete',
        'playoffs', 'championship', 'ncaa', 'nhl', 'fifa', 'tennis', 'grand slam',
    ],
    'entertainment': ['entertainment', 'movie', 'film', 'tv', 'television', 'show', 'celebrity', 'actor', 'actress', 'hollywood'],
    'lifestyle': ['lifestyle', 'wellness', 'fitness', 'diet', 'nutrition', 'exercise', 'yoga', 'meditation'],
    'parenting': ['parenting', 'parent', 'child', 'children', 'kids', 'family', 'baby', 'toddler', 'teen', 'education'],
    'relationships': ['relationship', 'relationships', 'dating', 'marriage', 'divorce', 'love', 'romance', 'couple'],
    'education': ['education', 'school', 'university', 'college', 'student', 'teacher', 'academic', 'degree', 'curriculum'],
    
    // Specialized
    'security': [
        'security', 'cybersecurity', 'hack', 'hacking', 'breach', 'data breach', 'privacy', 'encryption',
        'malware', 'virus', 'public safety', 'crime alert', 'shooting', 'emergency response',
    ],
    'privacy': ['privacy', 'data privacy', 'gdpr', 'personal data', 'surveillance', 'tracking'],
    'energy': ['energy', 'oil', 'gas', 'petroleum', 'nuclear', 'power plant', 'electricity', 'energy policy'],
    'transportation': ['transportation', 'transport', 'car', 'vehicle', 'automobile', 'tesla', 'electric vehicle', 'ev', 'airline', 'airport'],
    'real_estate': ['real estate', 'housing', 'home', 'property', 'mortgage', 'rent', 'apartment', 'house', 'real estate market'],
};

const SOURCE_CATEGORY_TO_FALLBACK_TOPIC: Record<string, string> = {
    business_economy: 'general_business',
    finance_markets_investing: 'general_business',
    federal_government: 'general_federal_government',
    dmv_local: 'general_local',
    tech_ai_automation: 'general_tech',
    health_science: 'general_health',
    sports: 'general_sports',
    world_news: 'general_politics',
    national_news: 'general_news',
    real_estate_housing: 'general_business',
    entertainment_culture: 'general_news',
};

/**
 * Match article to topics based on title and description
 */
export function matchArticleToTopics(
    title: string,
    description: string | null,
    availableTopics: Array<{ id: string; name: string; display_name: string }>
): string[] {
    const matchedTopicIds: string[] = [];
    const text = `${title} ${description || ''}`.toLowerCase();

    // Create a map of topic name to topic ID
    const topicNameToId: Record<string, string> = {};
    availableTopics.forEach(topic => {
        topicNameToId[topic.name] = topic.id;
    });

    // Check each topic's keywords
    for (const [topicName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        const topicId = topicNameToId[topicName];
        if (!topicId) {
            // Log missing topics for debugging
            console.log(`⚠️  Topic "${topicName}" not found in available topics`);
            continue; // Topic not available
        }

        // Strict matching: require whole-word / whole-phrase matches only.
        // This prevents false positives like "said" matching "ai" or "whether" matching "eth".
        const matches = keywords.some((keyword) => {
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
            return regex.test(text);
        });

        if (matches) {
            matchedTopicIds.push(topicId);
        }
    }

    return matchedTopicIds;
}

export function getFallbackTopicNameForSourceCategory(sourceCategory: string | null | undefined): string {
    if (!sourceCategory) return 'general_news';
    return SOURCE_CATEGORY_TO_FALLBACK_TOPIC[sourceCategory] || 'general_news';
}
