export type NewsSourceCategory =
    | 'federal_government'
    | 'dmv_local'
    | 'national_news'
    | 'world_news'
    | 'business_economy'
    | 'tech_ai_automation'
    | 'finance_markets_investing'
    | 'real_estate_housing'
    | 'health_science'
    | 'sports'
    | 'entertainment_culture';

export type SourceRegistryEntry = {
    name: string;
    display_name: string;
    domain: string;
    category: NewsSourceCategory;
    region: string;
    url: string;
    rss_url: string | null;
    reliability_score: number;
    priority_weight: number;
    is_active: boolean;
};

export const APPROVED_SOURCE_REGISTRY: SourceRegistryEntry[] = [
    { name: 'reuters', display_name: 'Reuters', domain: 'reuters.com', category: 'national_news', region: 'US/Global', url: 'https://www.reuters.com', rss_url: 'https://www.reuters.com/world/rss', reliability_score: 0.96, priority_weight: 1.3, is_active: true },
    { name: 'ap_news', display_name: 'AP News', domain: 'apnews.com', category: 'national_news', region: 'US', url: 'https://apnews.com', rss_url: null, reliability_score: 0.95, priority_weight: 1.28, is_active: true },
    { name: 'politico', display_name: 'Politico', domain: 'politico.com', category: 'federal_government', region: 'US', url: 'https://www.politico.com', rss_url: null, reliability_score: 0.9, priority_weight: 1.22, is_active: true },
    { name: 'axios', display_name: 'Axios', domain: 'axios.com', category: 'national_news', region: 'US', url: 'https://www.axios.com', rss_url: 'https://api.axios.com/feed/', reliability_score: 0.88, priority_weight: 1.16, is_active: true },
    { name: 'the_hill', display_name: 'The Hill', domain: 'thehill.com', category: 'federal_government', region: 'US', url: 'https://thehill.com', rss_url: 'https://thehill.com/feed/', reliability_score: 0.86, priority_weight: 1.12, is_active: true },
    { name: 'federal_news_network', display_name: 'Federal News Network', domain: 'federalnewsnetwork.com', category: 'federal_government', region: 'US', url: 'https://federalnewsnetwork.com', rss_url: 'https://federalnewsnetwork.com/feed/', reliability_score: 0.91, priority_weight: 1.3, is_active: true },
    { name: 'government_executive', display_name: 'Government Executive', domain: 'govexec.com', category: 'federal_government', region: 'US', url: 'https://www.govexec.com', rss_url: 'https://www.govexec.com/rss/all/', reliability_score: 0.9, priority_weight: 1.24, is_active: true },
    { name: 'fedscoop', display_name: 'FedScoop', domain: 'fedscoop.com', category: 'federal_government', region: 'US', url: 'https://fedscoop.com', rss_url: 'https://fedscoop.com/feed/', reliability_score: 0.89, priority_weight: 1.2, is_active: true },
    { name: 'nextgov_fcw', display_name: 'Nextgov/FCW', domain: 'nextgov.com', category: 'federal_government', region: 'US', url: 'https://www.nextgov.com', rss_url: null, reliability_score: 0.89, priority_weight: 1.18, is_active: true },
    { name: 'roll_call', display_name: 'Roll Call', domain: 'rollcall.com', category: 'federal_government', region: 'US', url: 'https://rollcall.com', rss_url: 'https://rollcall.com/feed/', reliability_score: 0.87, priority_weight: 1.14, is_active: true },
    { name: 'defense_one', display_name: 'Defense One', domain: 'defenseone.com', category: 'federal_government', region: 'US', url: 'https://www.defenseone.com', rss_url: null, reliability_score: 0.87, priority_weight: 1.12, is_active: true },
    { name: 'wtop', display_name: 'WTOP', domain: 'wtop.com', category: 'dmv_local', region: 'DMV', url: 'https://wtop.com', rss_url: 'https://wtop.com/feed/', reliability_score: 0.89, priority_weight: 1.24, is_active: true },
    { name: 'dcist', display_name: 'DCist', domain: 'dcist.com', category: 'dmv_local', region: 'DMV', url: 'https://dcist.com', rss_url: null, reliability_score: 0.84, priority_weight: 1.08, is_active: true },
    { name: 'washingtonian', display_name: 'Washingtonian', domain: 'washingtonian.com', category: 'dmv_local', region: 'DMV', url: 'https://www.washingtonian.com', rss_url: 'https://www.washingtonian.com/feed/', reliability_score: 0.8, priority_weight: 1.0, is_active: true },
    { name: 'washington_business_journal', display_name: 'Washington Business Journal', domain: 'bizjournals.com', category: 'business_economy', region: 'DMV', url: 'https://www.bizjournals.com/washington', rss_url: null, reliability_score: 0.86, priority_weight: 1.08, is_active: true },
    { name: 'nbc_washington', display_name: 'NBC Washington', domain: 'nbcwashington.com', category: 'dmv_local', region: 'DMV', url: 'https://www.nbcwashington.com', rss_url: 'https://www.nbcwashington.com/news/local/?rss=y', reliability_score: 0.82, priority_weight: 1.06, is_active: true },
    { name: 'fox_5_dc', display_name: 'FOX 5 DC', domain: 'fox5dc.com', category: 'dmv_local', region: 'DMV', url: 'https://www.fox5dc.com', rss_url: null, reliability_score: 0.76, priority_weight: 0.95, is_active: true },
    { name: 'abc7_dc', display_name: 'ABC7 DC', domain: 'wjla.com', category: 'dmv_local', region: 'DMV', url: 'https://wjla.com', rss_url: null, reliability_score: 0.79, priority_weight: 0.98, is_active: true },
    { name: 'wusa9', display_name: 'WUSA9', domain: 'wusa9.com', category: 'dmv_local', region: 'DMV', url: 'https://www.wusa9.com', rss_url: null, reliability_score: 0.79, priority_weight: 0.98, is_active: true },
    { name: 'dc_news_now', display_name: 'DC News Now', domain: 'dcnewsnow.com', category: 'dmv_local', region: 'DMV', url: 'https://www.dcnewsnow.com', rss_url: null, reliability_score: 0.74, priority_weight: 0.9, is_active: true },
    { name: 'arlnow', display_name: 'ARLnow', domain: 'arlnow.com', category: 'dmv_local', region: 'DMV', url: 'https://www.arlnow.com', rss_url: 'https://www.arlnow.com/feed/', reliability_score: 0.81, priority_weight: 1.02, is_active: true },
    { name: 'alxnow', display_name: 'ALXnow', domain: 'alxnow.com', category: 'dmv_local', region: 'DMV', url: 'https://www.alxnow.com', rss_url: null, reliability_score: 0.79, priority_weight: 0.98, is_active: true },
    { name: 'ffxnow', display_name: 'FFXnow', domain: 'ffxnow.com', category: 'dmv_local', region: 'DMV', url: 'https://www.ffxnow.com', rss_url: null, reliability_score: 0.79, priority_weight: 0.98, is_active: true },
    { name: 'moco360', display_name: 'MoCo360', domain: 'moco360.media', category: 'dmv_local', region: 'DMV', url: 'https://moco360.media', rss_url: null, reliability_score: 0.78, priority_weight: 0.96, is_active: true },
    { name: 'bethesda_magazine', display_name: 'Bethesda Magazine', domain: 'bethesdamagazine.com', category: 'dmv_local', region: 'DMV', url: 'https://bethesdamagazine.com', rss_url: null, reliability_score: 0.77, priority_weight: 0.94, is_active: true },
    { name: 'source_of_the_spring', display_name: 'Source of the Spring', domain: 'sourceofthespring.com', category: 'dmv_local', region: 'DMV', url: 'https://www.sourceofthespring.com', rss_url: null, reliability_score: 0.75, priority_weight: 0.92, is_active: true },
    { name: 'greater_greater_washington', display_name: 'Greater Greater Washington', domain: 'ggwash.org', category: 'dmv_local', region: 'DMV', url: 'https://ggwash.org', rss_url: null, reliability_score: 0.8, priority_weight: 0.98, is_active: true },
    { name: 'dc_urban_turf', display_name: 'DC Urban Turf', domain: 'dc.urbanturf.com', category: 'real_estate_housing', region: 'DMV', url: 'https://dc.urbanturf.com', rss_url: null, reliability_score: 0.78, priority_weight: 0.98, is_active: true },
    { name: 'the_dc_line', display_name: 'The DC Line', domain: 'thedcline.org', category: 'dmv_local', region: 'DMV', url: 'https://thedcline.org', rss_url: null, reliability_score: 0.79, priority_weight: 0.98, is_active: true },
    { name: 'nytimes', display_name: 'New York Times', domain: 'nytimes.com', category: 'national_news', region: 'US', url: 'https://www.nytimes.com', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', reliability_score: 0.93, priority_weight: 1.15, is_active: true },
    { name: 'washington_post', display_name: 'Washington Post', domain: 'washingtonpost.com', category: 'national_news', region: 'US', url: 'https://www.washingtonpost.com', rss_url: null, reliability_score: 0.92, priority_weight: 1.16, is_active: true },
    { name: 'usa_today', display_name: 'USA Today', domain: 'usatoday.com', category: 'national_news', region: 'US', url: 'https://www.usatoday.com', rss_url: null, reliability_score: 0.83, priority_weight: 1.0, is_active: true },
    { name: 'npr', display_name: 'NPR', domain: 'npr.org', category: 'national_news', region: 'US', url: 'https://www.npr.org', rss_url: 'https://feeds.npr.org/1001/rss.xml', reliability_score: 0.92, priority_weight: 1.12, is_active: true },
    { name: 'bbc', display_name: 'BBC', domain: 'bbc.com', category: 'world_news', region: 'Global', url: 'https://www.bbc.com/news', rss_url: 'https://feeds.bbci.co.uk/news/rss.xml', reliability_score: 0.9, priority_weight: 1.08, is_active: true },
    { name: 'cnn', display_name: 'CNN', domain: 'cnn.com', category: 'national_news', region: 'US', url: 'https://www.cnn.com', rss_url: 'http://rss.cnn.com/rss/edition.rss', reliability_score: 0.8, priority_weight: 0.96, is_active: true },
    { name: 'nbc_news', display_name: 'NBC News', domain: 'nbcnews.com', category: 'national_news', region: 'US', url: 'https://www.nbcnews.com', rss_url: null, reliability_score: 0.84, priority_weight: 1.0, is_active: true },
    { name: 'cbs_news', display_name: 'CBS News', domain: 'cbsnews.com', category: 'national_news', region: 'US', url: 'https://www.cbsnews.com', rss_url: null, reliability_score: 0.83, priority_weight: 0.98, is_active: true },
    { name: 'abc_news', display_name: 'ABC News', domain: 'abcnews.go.com', category: 'national_news', region: 'US', url: 'https://abcnews.go.com', rss_url: 'https://abcnews.go.com/abcnews/topstories', reliability_score: 0.83, priority_weight: 0.98, is_active: true },
    { name: 'al_jazeera_english', display_name: 'Al Jazeera English', domain: 'aljazeera.com', category: 'world_news', region: 'Global', url: 'https://www.aljazeera.com', rss_url: 'https://www.aljazeera.com/xml/rss/all.xml', reliability_score: 0.84, priority_weight: 1.0, is_active: true },
    { name: 'the_guardian', display_name: 'The Guardian', domain: 'theguardian.com', category: 'world_news', region: 'Global', url: 'https://www.theguardian.com', rss_url: 'https://www.theguardian.com/world/rss', reliability_score: 0.89, priority_weight: 1.06, is_active: true },
    { name: 'financial_times', display_name: 'Financial Times', domain: 'ft.com', category: 'business_economy', region: 'Global', url: 'https://www.ft.com', rss_url: 'https://www.ft.com/world?format=rss', reliability_score: 0.94, priority_weight: 1.2, is_active: true },
    { name: 'economist', display_name: 'The Economist', domain: 'economist.com', category: 'business_economy', region: 'Global', url: 'https://www.economist.com', rss_url: 'https://www.economist.com/finance-and-economics/rss.xml', reliability_score: 0.92, priority_weight: 1.16, is_active: true },
    { name: 'bloomberg', display_name: 'Bloomberg', domain: 'bloomberg.com', category: 'finance_markets_investing', region: 'Global', url: 'https://www.bloomberg.com', rss_url: 'https://feeds.bloomberg.com/markets/news.rss', reliability_score: 0.93, priority_weight: 1.22, is_active: true },
    { name: 'cnbc', display_name: 'CNBC', domain: 'cnbc.com', category: 'finance_markets_investing', region: 'US', url: 'https://www.cnbc.com', rss_url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', reliability_score: 0.87, priority_weight: 1.08, is_active: true },
    { name: 'marketwatch', display_name: 'MarketWatch', domain: 'marketwatch.com', category: 'finance_markets_investing', region: 'US', url: 'https://www.marketwatch.com', rss_url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', reliability_score: 0.84, priority_weight: 1.0, is_active: true },
    { name: 'yahoo_finance', display_name: 'Yahoo Finance', domain: 'finance.yahoo.com', category: 'finance_markets_investing', region: 'US', url: 'https://finance.yahoo.com', rss_url: null, reliability_score: 0.78, priority_weight: 0.94, is_active: true },
    { name: 'wsj', display_name: 'WSJ', domain: 'wsj.com', category: 'finance_markets_investing', region: 'US', url: 'https://www.wsj.com', rss_url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', reliability_score: 0.92, priority_weight: 1.14, is_active: true },
    { name: 'barrons', display_name: "Barron's", domain: 'barrons.com', category: 'finance_markets_investing', region: 'US', url: 'https://www.barrons.com', rss_url: null, reliability_score: 0.89, priority_weight: 1.06, is_active: true },
    { name: 'the_verge', display_name: 'The Verge', domain: 'theverge.com', category: 'tech_ai_automation', region: 'US', url: 'https://www.theverge.com', rss_url: 'https://www.theverge.com/rss/index.xml', reliability_score: 0.84, priority_weight: 1.04, is_active: true },
    { name: 'techcrunch', display_name: 'TechCrunch', domain: 'techcrunch.com', category: 'tech_ai_automation', region: 'US', url: 'https://techcrunch.com', rss_url: 'https://techcrunch.com/feed/', reliability_score: 0.82, priority_weight: 1.02, is_active: true },
    { name: 'wired', display_name: 'Wired', domain: 'wired.com', category: 'tech_ai_automation', region: 'US', url: 'https://www.wired.com', rss_url: 'https://www.wired.com/feed/rss', reliability_score: 0.85, priority_weight: 1.0, is_active: true },
    { name: 'ars_technica', display_name: 'Ars Technica', domain: 'arstechnica.com', category: 'tech_ai_automation', region: 'US', url: 'https://arstechnica.com', rss_url: 'https://feeds.arstechnica.com/arstechnica/index', reliability_score: 0.86, priority_weight: 1.02, is_active: true },
    { name: 'mit_technology_review', display_name: 'MIT Technology Review', domain: 'technologyreview.com', category: 'tech_ai_automation', region: 'US', url: 'https://www.technologyreview.com', rss_url: 'https://www.technologyreview.com/feed/', reliability_score: 0.9, priority_weight: 1.08, is_active: true },
    { name: 'venturebeat', display_name: 'VentureBeat', domain: 'venturebeat.com', category: 'tech_ai_automation', region: 'US', url: 'https://venturebeat.com', rss_url: 'https://venturebeat.com/feed/', reliability_score: 0.8, priority_weight: 0.96, is_active: true },
    { name: 'the_information', display_name: 'The Information', domain: 'theinformation.com', category: 'tech_ai_automation', region: 'US', url: 'https://www.theinformation.com', rss_url: null, reliability_score: 0.9, priority_weight: 1.08, is_active: true },
    { name: 'seeking_alpha', display_name: 'Seeking Alpha', domain: 'seekingalpha.com', category: 'finance_markets_investing', region: 'US', url: 'https://seekingalpha.com', rss_url: null, reliability_score: 0.76, priority_weight: 0.9, is_active: true },
    { name: 'morningstar', display_name: 'Morningstar', domain: 'morningstar.com', category: 'finance_markets_investing', region: 'US', url: 'https://www.morningstar.com', rss_url: null, reliability_score: 0.86, priority_weight: 1.0, is_active: true },
    { name: 'redfin_news', display_name: 'Redfin News', domain: 'redfin.com', category: 'real_estate_housing', region: 'US', url: 'https://www.redfin.com/news', rss_url: null, reliability_score: 0.75, priority_weight: 0.92, is_active: true },
    { name: 'zillow_research', display_name: 'Zillow Research', domain: 'zillow.com', category: 'real_estate_housing', region: 'US', url: 'https://www.zillow.com/research', rss_url: null, reliability_score: 0.78, priority_weight: 0.95, is_active: true },
    { name: 'realtor_com_news', display_name: 'Realtor.com News', domain: 'realtor.com', category: 'real_estate_housing', region: 'US', url: 'https://www.realtor.com/news', rss_url: null, reliability_score: 0.74, priority_weight: 0.9, is_active: true },
    { name: 'housingwire', display_name: 'HousingWire', domain: 'housingwire.com', category: 'real_estate_housing', region: 'US', url: 'https://www.housingwire.com', rss_url: null, reliability_score: 0.82, priority_weight: 0.98, is_active: true },
    { name: 'cdc_newsroom', display_name: 'CDC Newsroom', domain: 'cdc.gov', category: 'health_science', region: 'US', url: 'https://www.cdc.gov/media', rss_url: null, reliability_score: 0.95, priority_weight: 1.1, is_active: true },
    { name: 'nih_news', display_name: 'NIH News', domain: 'nih.gov', category: 'health_science', region: 'US', url: 'https://www.nih.gov/news-events', rss_url: null, reliability_score: 0.95, priority_weight: 1.1, is_active: true },
    { name: 'healthline', display_name: 'Healthline', domain: 'healthline.com', category: 'health_science', region: 'US', url: 'https://www.healthline.com', rss_url: null, reliability_score: 0.78, priority_weight: 0.9, is_active: true },
    { name: 'webmd', display_name: 'WebMD', domain: 'webmd.com', category: 'health_science', region: 'US', url: 'https://www.webmd.com', rss_url: null, reliability_score: 0.76, priority_weight: 0.88, is_active: true },
    { name: 'sciencedaily', display_name: 'ScienceDaily', domain: 'sciencedaily.com', category: 'health_science', region: 'Global', url: 'https://www.sciencedaily.com', rss_url: 'https://www.sciencedaily.com/rss/top/science.xml', reliability_score: 0.8, priority_weight: 0.92, is_active: true },
    { name: 'nature_news', display_name: 'Nature News', domain: 'nature.com', category: 'health_science', region: 'Global', url: 'https://www.nature.com/news', rss_url: 'https://www.nature.com/nature.rss', reliability_score: 0.93, priority_weight: 1.06, is_active: true },
    { name: 'espn', display_name: 'ESPN', domain: 'espn.com', category: 'sports', region: 'US', url: 'https://www.espn.com', rss_url: 'https://www.espn.com/espn/rss/news', reliability_score: 0.8, priority_weight: 0.86, is_active: true },
    { name: 'bleacher_report', display_name: 'Bleacher Report', domain: 'bleacherreport.com', category: 'sports', region: 'US', url: 'https://bleacherreport.com', rss_url: null, reliability_score: 0.72, priority_weight: 0.8, is_active: true },
    { name: 'the_athletic', display_name: 'The Athletic', domain: 'theathletic.com', category: 'sports', region: 'US', url: 'https://theathletic.com', rss_url: null, reliability_score: 0.84, priority_weight: 0.9, is_active: true },
    { name: 'cbs_sports', display_name: 'CBS Sports', domain: 'cbssports.com', category: 'sports', region: 'US', url: 'https://www.cbssports.com', rss_url: null, reliability_score: 0.78, priority_weight: 0.84, is_active: true },
    { name: 'nbc_sports', display_name: 'NBC Sports', domain: 'nbcsports.com', category: 'sports', region: 'US', url: 'https://www.nbcsports.com', rss_url: null, reliability_score: 0.78, priority_weight: 0.84, is_active: true },
    { name: 'variety', display_name: 'Variety', domain: 'variety.com', category: 'entertainment_culture', region: 'US', url: 'https://variety.com', rss_url: 'https://variety.com/feed/', reliability_score: 0.78, priority_weight: 0.72, is_active: true },
    { name: 'hollywood_reporter', display_name: 'Hollywood Reporter', domain: 'hollywoodreporter.com', category: 'entertainment_culture', region: 'US', url: 'https://www.hollywoodreporter.com', rss_url: null, reliability_score: 0.76, priority_weight: 0.7, is_active: true },
    { name: 'buzzfeed_news', display_name: 'BuzzFeed News', domain: 'buzzfeednews.com', category: 'entertainment_culture', region: 'US', url: 'https://www.buzzfeednews.com', rss_url: null, reliability_score: 0.64, priority_weight: 0.58, is_active: true },
    { name: 'tmz', display_name: 'TMZ', domain: 'tmz.com', category: 'entertainment_culture', region: 'US', url: 'https://www.tmz.com', rss_url: null, reliability_score: 0.32, priority_weight: 0.3, is_active: true },
];

const MAINSTREAM_GLOBAL_CATEGORIES = new Set<NewsSourceCategory>([
    'national_news',
    'world_news',
    'business_economy',
]);

/** Mainstream wire/national outlets used for the dashboard global trending feed. */
export function getMainstreamGlobalSourceNames(): string[] {
    return APPROVED_SOURCE_REGISTRY.filter(
        (source) =>
            source.is_active &&
            source.rss_url &&
            MAINSTREAM_GLOBAL_CATEGORIES.has(source.category),
    )
        .sort((a, b) => b.priority_weight - a.priority_weight)
        .map((source) => source.name);
}
