import { buildArticleSummaryView, getSummaryParagraph } from '@/lib/newsfeed/articlePresentation';

describe('buildArticleSummaryView', () => {
    it('prefers analysis why_it_matters over stored summary', () => {
        const view = buildArticleSummaryView(
            { summary_1_paragraph: null, summary_2_paragraphs: null, summary_3_paragraphs: null, summary_4_paragraphs: null, summary_5_paragraphs: null, why_it_matters: 'Stored reason' },
            { why_it_matters: 'AI reason', user_action: 'Review guidance.' },
            'RSS description',
        );

        expect(view?.why_it_matters).toBe('AI reason');
        expect(view?.action_suggestion).toBe('Review guidance.');
        expect(view?.paragraphs_1).toBe('RSS description');
    });

    it('returns null when no content is available', () => {
        expect(buildArticleSummaryView(null, null, null)).toBeNull();
    });
});

describe('getSummaryParagraph', () => {
    it('falls back to paragraphs_1 then description', () => {
        const summary = buildArticleSummaryView(
            { summary_1_paragraph: 'One paragraph', summary_2_paragraphs: null, summary_3_paragraphs: null, summary_4_paragraphs: null, summary_5_paragraphs: null, why_it_matters: null },
            null,
            'Fallback',
        );

        expect(getSummaryParagraph(summary, 3)).toBe('One paragraph');
        expect(getSummaryParagraph(null, 1, 'Fallback')).toBe('Fallback');
    });
});
