import {
    parseNoteImages,
    splitNoteContent,
    stripNoteImages,
    removeImageMarkdown,
    combineNoteTextAndImages,
    imageMarkdownForUrl,
} from '@/lib/dailyNoteImages';

describe('dailyNoteImages', () => {
    describe('parseNoteImages', () => {
        it('extracts markdown image references', () => {
            const text = 'Hello\n![screenshot](https://example.com/a.png)\nMore text';
            expect(parseNoteImages(text)).toEqual([
                {
                    alt: 'screenshot',
                    url: 'https://example.com/a.png',
                    markdown: '![screenshot](https://example.com/a.png)',
                },
            ]);
        });
    });

    describe('stripNoteImages', () => {
        it('removes image markdown and extra blank lines', () => {
            const text = 'Line one\n\n![image](https://example.com/a.png)\n\nLine two';
            expect(stripNoteImages(text)).toBe('Line one\n\nLine two');
        });
    });

    describe('splitNoteContent', () => {
        it('splits text and images in order', () => {
            const text = 'Before\n![image](https://example.com/a.png)\nAfter';
            expect(splitNoteContent(text)).toEqual([
                { type: 'text', text: 'Before\n' },
                { type: 'image', alt: 'image', url: 'https://example.com/a.png' },
                { type: 'text', text: '\nAfter' },
            ]);
        });

        it('preserves inline text around images', () => {
            const text = 'Hello ![image](https://example.com/a.png) world';
            expect(splitNoteContent(text)).toEqual([
                { type: 'text', text: 'Hello ' },
                { type: 'image', alt: 'image', url: 'https://example.com/a.png' },
                { type: 'text', text: ' world' },
            ]);
        });
    });

    describe('removeImageMarkdown', () => {
        it('removes a specific image markdown snippet', () => {
            const text = 'Hello\n![image](https://example.com/a.png)\nWorld';
            expect(removeImageMarkdown(text, '![image](https://example.com/a.png)')).toBe('Hello\nWorld');
        });
    });

    describe('combineNoteTextAndImages', () => {
        it('keeps text and appends image markdown for storage', () => {
            const images = parseNoteImages('![image](https://example.com/a.png)');
            expect(combineNoteTextAndImages('My note', images)).toBe(
                'My note\n\n![image](https://example.com/a.png)'
            );
        });

        it('stores images only when there is no text', () => {
            const markdown = imageMarkdownForUrl('https://example.com/a.png');
            const images = parseNoteImages(markdown);
            expect(combineNoteTextAndImages('', images)).toBe(markdown);
        });
    });
});
