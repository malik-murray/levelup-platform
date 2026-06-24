'use client';

import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    INLINE_NOTE_IMAGE_CLASS,
    INLINE_NOTE_IMAGE_REMOVE_CLASS,
    INLINE_NOTE_IMAGE_WRAP_CLASS,
} from '@/lib/dailyNoteEditor';

export default function NoteImageLightbox({
    url,
    alt = 'Note image',
    onClose,
}: {
    url: string | null;
    alt?: string;
    onClose: () => void;
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!url) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [url, onClose]);

    if (!mounted || !url) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded note image"
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-black/60 text-2xl text-white active:bg-black/80"
                aria-label="Close image"
            >
                ×
            </button>
            <img
                src={url}
                alt={alt}
                className="max-h-[calc(100dvh-6rem)] max-w-full touch-pan-y rounded-lg object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            />
        </div>,
        document.body
    );
}

export function resolveNoteImageWrap(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    if (target.classList.contains(INLINE_NOTE_IMAGE_REMOVE_CLASS)) return null;
    const wrap = target.closest(`.${INLINE_NOTE_IMAGE_WRAP_CLASS}`);
    return wrap instanceof HTMLElement ? wrap : null;
}

export function openNoteImageFromWrap(wrap: HTMLElement): { url: string; alt: string } | null {
    const img = wrap.querySelector(`.${INLINE_NOTE_IMAGE_CLASS}`);
    if (!(img instanceof HTMLImageElement) || !img.src) return null;
    return { url: img.src, alt: img.alt || 'Note image' };
}

export function handleNoteImagePointerUp(
    event: PointerEvent<HTMLElement>,
    onOpen: (image: { url: string; alt: string }) => void
) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const removeTarget = event.target instanceof HTMLElement ? event.target : null;
    if (removeTarget?.classList.contains(INLINE_NOTE_IMAGE_REMOVE_CLASS)) return;

    const wrap = resolveNoteImageWrap(event.target);
    if (!wrap) return;

    const image = openNoteImageFromWrap(wrap);
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    onOpen(image);
}
