export type StoredArticleSummary = {
    summary_1_paragraph: string | null;
    summary_2_paragraphs: string | null;
    summary_3_paragraphs: string | null;
    summary_4_paragraphs: string | null;
    summary_5_paragraphs: string | null;
    why_it_matters: string | null;
};

export type StoredArticleAnalysis = {
    why_it_matters: string | null;
    user_action: string | null;
    final_score?: number | null;
    importance_score?: number | null;
    urgency_score?: number | null;
};

export type ArticleSummaryView = {
    paragraphs_1: string | null;
    paragraphs_2: string | null;
    paragraphs_3: string | null;
    paragraphs_4: string | null;
    paragraphs_5: string | null;
    why_it_matters: string | null;
    action_suggestion: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Merge stored summaries, LangGraph analysis, and RSS description for API/UI consumption.
 * Analysis fields take precedence for why_it_matters; description fills paragraphs_1 when missing.
 */
export function buildArticleSummaryView(
    storedSummary: StoredArticleSummary | null,
    analysis: StoredArticleAnalysis | null,
    description: string | null,
): ArticleSummaryView | null {
    const paragraphs_1 =
        nonEmpty(storedSummary?.summary_1_paragraph) ?? nonEmpty(description);
    const why_it_matters =
        nonEmpty(analysis?.why_it_matters) ?? nonEmpty(storedSummary?.why_it_matters);
    const action_suggestion = nonEmpty(analysis?.user_action);

    const hasLongerSummary =
        nonEmpty(storedSummary?.summary_2_paragraphs) ||
        nonEmpty(storedSummary?.summary_3_paragraphs) ||
        nonEmpty(storedSummary?.summary_4_paragraphs) ||
        nonEmpty(storedSummary?.summary_5_paragraphs);

    if (!paragraphs_1 && !why_it_matters && !action_suggestion && !hasLongerSummary) {
        return null;
    }

    return {
        paragraphs_1,
        paragraphs_2: nonEmpty(storedSummary?.summary_2_paragraphs),
        paragraphs_3: nonEmpty(storedSummary?.summary_3_paragraphs),
        paragraphs_4: nonEmpty(storedSummary?.summary_4_paragraphs),
        paragraphs_5: nonEmpty(storedSummary?.summary_5_paragraphs),
        why_it_matters,
        action_suggestion,
    };
}

export function getSummaryParagraph(
    summary: ArticleSummaryView | null,
    preferredLength: number,
    fallbackDescription?: string | null,
): string {
    if (!summary) {
        return nonEmpty(fallbackDescription) ?? '';
    }

    const key = `paragraphs_${preferredLength}` as keyof ArticleSummaryView;
    const preferred = summary[key];
    if (typeof preferred === 'string' && preferred.trim()) {
        return preferred;
    }

    return summary.paragraphs_1 ?? nonEmpty(fallbackDescription) ?? '';
}
