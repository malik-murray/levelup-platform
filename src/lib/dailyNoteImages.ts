import { createRandomId } from '@/lib/createRandomId';

export const DAILY_NOTE_IMAGES_BUCKET = 'daily-note-images';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DAILY_NOTE_IMAGE_BYTES = MAX_IMAGE_SIZE_BYTES;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export type NoteImageRef = {
    alt: string;
    url: string;
    markdown: string;
};

function imageMarkdownRegex(): RegExp {
    return /!\[([^\]]*)\]\(([^)]+)\)/g;
}

export function parseNoteImages(text: string): NoteImageRef[] {
    const images: NoteImageRef[] = [];
    for (const match of text.matchAll(imageMarkdownRegex())) {
        const markdown = match[0];
        const alt = match[1] ?? 'image';
        const url = match[2] ?? '';
        if (!url) continue;
        images.push({ alt, url, markdown });
    }
    return images;
}

export function stripNoteImages(text: string): string {
    return stripNoteImagesForDisplay(text).trim();
}

export function stripNoteImagesForDisplay(text: string): string {
    return text.replace(imageMarkdownRegex(), '').replace(/\n{3,}/g, '\n\n');
}

export function imageMarkdownForUrl(url: string): string {
    return `![image](${url})`;
}

export function combineNoteTextAndImages(text: string, images: NoteImageRef[]): string {
    const imageBlock = images.map((image) => image.markdown).join('\n');
    const trimmedText = text.replace(/\s+$/g, '');
    if (!imageBlock) return trimmedText;
    if (!trimmedText) return imageBlock;
    return `${trimmedText}\n\n${imageBlock}`;
}

export type NoteContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; alt: string; url: string };

export function splitNoteContent(text: string): NoteContentPart[] {
    const parts: NoteContentPart[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(imageMarkdownRegex())) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            parts.push({ type: 'text', text: text.slice(lastIndex, index) });
        }
        const url = match[2] ?? '';
        if (url) {
            parts.push({ type: 'image', alt: match[1] || 'image', url });
        }
        lastIndex = index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: 'text', text: text.slice(lastIndex) });
    }

    return parts;
}

function extensionForMime(mime: string): string {
    switch (mime) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/gif':
            return 'gif';
        case 'image/webp':
            return 'webp';
        default:
            return 'png';
    }
}

export function removeImageMarkdown(value: string, markdown: string): string {
    const escaped = markdown.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value
        .replace(new RegExp(`\\n?${escaped}\\n?`), '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();
}

export async function uploadDailyNoteImage(
    userId: string,
    dateStr: string,
    section: string,
    file: File | Blob,
    uploadFile: (
        path: string,
        file: File | Blob,
        options: { contentType: string }
    ) => Promise<{ error: { message: string } | null }>,
    getPublicUrl: (path: string) => string
): Promise<{ url: string } | { error: string }> {
    const mime = file.type || 'image/jpeg';
    if (mime && !ALLOWED_IMAGE_TYPES.has(mime)) {
        return { error: 'Image must be JPEG, PNG, GIF, or WebP' };
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return { error: 'Image must be under 5MB' };
    }

    const ext = extensionForMime(mime);
    const path = `${userId}/${dateStr}/${section}/${createRandomId()}.${ext}`;

    const { error } = await uploadFile(path, file, { contentType: mime });
    if (error) {
        return { error: error.message };
    }

    return { url: getPublicUrl(path) };
}
