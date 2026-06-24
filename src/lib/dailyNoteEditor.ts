import { imageMarkdownForUrl, splitNoteContent } from '@/lib/dailyNoteImages';

export const INLINE_NOTE_IMAGE_WRAP_CLASS = 'inline-note-image-wrap';
export const INLINE_NOTE_IMAGE_CLASS = 'inline-note-image';
export const INLINE_NOTE_IMAGE_REMOVE_CLASS = 'inline-note-image-remove';

export function createInlineImageElement(url: string, alt: string): HTMLSpanElement {
    const wrap = document.createElement('span');
    wrap.className = INLINE_NOTE_IMAGE_WRAP_CLASS;
    wrap.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.className = INLINE_NOTE_IMAGE_CLASS;
    img.draggable = false;
    img.title = 'Tap to expand';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = INLINE_NOTE_IMAGE_REMOVE_CLASS;
    removeButton.setAttribute('aria-label', 'Remove image');
    removeButton.textContent = '×';

    wrap.appendChild(img);
    wrap.appendChild(removeButton);
    return wrap;
}

function appendTextWithBreaks(root: HTMLElement, text: string) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        if (line) root.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) root.appendChild(document.createElement('br'));
    });
}

export function populateNoteEditor(root: HTMLElement, value: string) {
    root.replaceChildren();
    if (!value) return;

    for (const part of splitNoteContent(value)) {
        if (part.type === 'text') {
            appendTextWithBreaks(root, part.text);
        } else {
            root.appendChild(createInlineImageElement(part.url, part.alt));
        }
    }
}

export function serializeNoteEditor(root: HTMLElement): string {
    let result = '';

    const appendText = (text: string) => {
        result += text.replace(/\u200B/g, '');
    };

    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            appendText(node.textContent ?? '');
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as HTMLElement;

        if (el.classList.contains(INLINE_NOTE_IMAGE_WRAP_CLASS)) {
            const img = el.querySelector('img');
            const url = img?.getAttribute('src') ?? '';
            if (url) appendText(imageMarkdownForUrl(url));
            return;
        }

        if (el.tagName === 'IMG') {
            const url = el.getAttribute('src') ?? '';
            if (url) appendText(imageMarkdownForUrl(url));
            return;
        }

        if (el.classList.contains(INLINE_NOTE_IMAGE_REMOVE_CLASS)) {
            return;
        }

        if (el.tagName === 'BR') {
            appendText('\n');
            return;
        }

        if ((el.tagName === 'DIV' || el.tagName === 'P') && el !== root) {
            if (result && !result.endsWith('\n')) appendText('\n');
            el.childNodes.forEach(walk);
            return;
        }

        el.childNodes.forEach(walk);
    };

    root.childNodes.forEach(walk);
    return result;
}

export function saveEditorSelection(editor: HTMLElement): Range | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
}

export function insertImageInEditor(editor: HTMLElement, url: string, savedRange?: Range | null) {
    const imageNode = createInlineImageElement(url, 'image');
    editor.focus();

    const selection = window.getSelection();
    const range = savedRange?.cloneRange();

    if (range && editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(imageNode);
        const spacer = document.createTextNode('\u200B');
        range.setStartAfter(imageNode);
        range.insertNode(spacer);
        range.setStartAfter(spacer);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
    }

    if (selection && selection.rangeCount > 0) {
        const liveRange = selection.getRangeAt(0);
        if (editor.contains(liveRange.commonAncestorContainer)) {
            liveRange.deleteContents();
            liveRange.insertNode(imageNode);
            liveRange.setStartAfter(imageNode);
            liveRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(liveRange);
            return;
        }
    }

    editor.appendChild(imageNode);
}
