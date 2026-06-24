'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import {
    INLINE_NOTE_IMAGE_REMOVE_CLASS,
    INLINE_NOTE_IMAGE_WRAP_CLASS,
    insertImageInEditor,
    populateNoteEditor,
    saveEditorSelection,
    serializeNoteEditor,
} from '@/lib/dailyNoteEditor';
import { prepareDailyNoteImageForUpload } from '@/lib/dailyNoteImagePrepare';
import { uploadDailyNoteImage, DAILY_NOTE_IMAGES_BUCKET } from '@/lib/dailyNoteImages';
import { supabase } from '@auth/supabaseClient';
import NoteImageLightbox, { handleNoteImagePointerUp } from '@/components/NoteImageLightbox';

function adjustEditorHeight(el: HTMLElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.max(80, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
}

function bindEditorAutoHeight(editor: HTMLElement) {
    const resize = () => {
        requestAnimationFrame(() => adjustEditorHeight(editor));
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(editor);

    const mutationObserver = new MutationObserver(resize);
    mutationObserver.observe(editor, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    editor.addEventListener('load', resize, true);

    return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        editor.removeEventListener('load', resize, true);
        editor.style.removeProperty('height');
    };
}

type DailyNotesContentKey = 'notes' | 'lessons' | 'feelings' | 'ideas' | 'reflection';

type DailyNoteFieldProps = {
    sectionKey: DailyNotesContentKey;
    value: string;
    placeholder: string;
    userId: string;
    dateStr: string;
    onChange: (value: string) => void;
    onSave: (value: string | null) => void;
};

export default function DailyNoteField({
    sectionKey,
    value,
    placeholder,
    userId,
    dateStr,
    onChange,
    onSave,
}: DailyNoteFieldProps) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const autoHeightCleanupRef = useRef<(() => void) | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const lastSyncedValueRef = useRef(value);
    const hasInitializedRef = useRef(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => () => autoHeightCleanupRef.current?.(), []);

    useEffect(() => {
        const media = window.matchMedia('(hover: none), (pointer: coarse)');
        const update = () => setIsTouchDevice(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        if (!hasInitializedRef.current || value !== lastSyncedValueRef.current) {
            populateNoteEditor(editor, value);
            lastSyncedValueRef.current = value;
            hasInitializedRef.current = true;
            adjustEditorHeight(editor);
        }
    }, [value]);

    const emitEditorValue = (save = false) => {
        const editor = editorRef.current;
        if (!editor) return;
        const serialized = serializeNoteEditor(editor);
        lastSyncedValueRef.current = serialized;
        onChange(serialized);
        adjustEditorHeight(editor);
        if (save) onSave(serialized || null);
    };

    const handleImageUpload = async (file: File | Blob) => {
        const editor = editorRef.current;
        if (!editor) return;

        setUploading(true);
        setUploadError(null);
        try {
            const prepared = await prepareDailyNoteImageForUpload(file);
            if ('error' in prepared) {
                setUploadError(prepared.error);
                return;
            }

            const result = await uploadDailyNoteImage(
                userId,
                dateStr,
                sectionKey,
                prepared.blob,
                (path, uploadBlob, options) =>
                    supabase.storage.from(DAILY_NOTE_IMAGES_BUCKET).upload(path, uploadBlob, {
                        contentType: prepared.mime || options.contentType,
                        upsert: false,
                    }),
                (path) => supabase.storage.from(DAILY_NOTE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
            );
            if ('error' in result) {
                const message = result.error.toLowerCase().includes('bucket not found')
                    ? 'Image storage is not set up yet. Run migration 081_create_daily_note_images_bucket.sql in Supabase.'
                    : result.error;
                setUploadError(message);
                return;
            }
            insertImageInEditor(editor, result.url, savedRangeRef.current);
            savedRangeRef.current = null;
            emitEditorValue(true);
        } finally {
            setUploading(false);
        }
    };

    const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (!item.type.startsWith('image/')) continue;
            e.preventDefault();
            const file = item.getAsFile();
            if (file) await handleImageUpload(file);
            return;
        }
    };

    const handleRemoveLightboxImage = () => {
        const editor = editorRef.current;
        const imageUrl = lightbox?.url;
        if (!editor || !imageUrl) return;

        for (const wrap of editor.querySelectorAll(`.${INLINE_NOTE_IMAGE_WRAP_CLASS}`)) {
            const img = wrap.querySelector('img');
            if (img instanceof HTMLImageElement && img.src === imageUrl) {
                wrap.remove();
                emitEditorValue(true);
                return;
            }
        }
    };

    const handleEditorClick = (e: MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;

        if (target.classList.contains(INLINE_NOTE_IMAGE_REMOVE_CLASS)) {
            e.preventDefault();
            target.closest(`.${INLINE_NOTE_IMAGE_WRAP_CLASS}`)?.remove();
            emitEditorValue();
        }
    };

    const handleEditorPointerUp = (e: PointerEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;

        if (target.classList.contains(INLINE_NOTE_IMAGE_REMOVE_CLASS)) {
            e.preventDefault();
            e.stopPropagation();
            target.closest(`.${INLINE_NOTE_IMAGE_WRAP_CLASS}`)?.remove();
            emitEditorValue();
            return;
        }

        handleNoteImagePointerUp(e, setLightbox);
    };

    const handleBulletListEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' || e.shiftKey) return;

        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;

        const preRange = range.cloneRange();
        preRange.selectNodeContents(editor);
        preRange.setEnd(range.startContainer, range.startOffset);
        const textBeforeCaret = preRange.toString();
        const lineStart = textBeforeCaret.lastIndexOf('\n') + 1;
        const currentLine = textBeforeCaret.slice(lineStart);
        if (!currentLine.startsWith('-')) return;

        e.preventDefault();
        const trimmedCurrentLine = currentLine.trim();
        const insertion = trimmedCurrentLine === '-' || trimmedCurrentLine === '- ' ? '\n' : '\n- ';
        document.execCommand('insertText', false, insertion);
        emitEditorValue();
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        if (editorRef.current) {
                            savedRangeRef.current = saveEditorSelection(editorRef.current);
                        }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#ff9d00]/30 px-2.5 py-1 text-xs font-medium text-[#ffcc66] transition-colors hover:bg-[#ff9d00]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                    {uploading ? 'Uploading...' : 'Add image'}
                </button>
                <span className="text-[11px] text-slate-500 sm:text-xs">Tap image to expand</span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageUpload(file);
                        e.target.value = '';
                    }}
                />
            </div>

            {uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}

            <div
                ref={(el) => {
                    editorRef.current = el;
                    autoHeightCleanupRef.current?.();
                    autoHeightCleanupRef.current = el ? bindEditorAutoHeight(el) : null;
                }}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={placeholder}
                data-placeholder={placeholder}
                onInput={() => emitEditorValue()}
                onBlur={() => onSave(lastSyncedValueRef.current || null)}
                onPaste={(e) => void handlePaste(e)}
                onKeyDown={handleBulletListEnter}
                onClick={handleEditorClick}
                onPointerUp={handleEditorPointerUp}
                className="notes-lined notes-editor w-full rounded-lg border border-[#ff9d00]/25 text-sm text-slate-200 focus:border-[#ff9d00]/55"
            />
            <NoteImageLightbox
                url={lightbox?.url ?? null}
                alt={lightbox?.alt}
                onClose={() => setLightbox(null)}
                onDelete={lightbox && isTouchDevice ? handleRemoveLightboxImage : undefined}
            />
        </div>
    );
}
