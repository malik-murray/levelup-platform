'use client';

import { useMemo, useState } from 'react';
import { splitNoteContent } from '@/lib/dailyNoteImages';
import NoteImageLightbox, { handleNoteImagePointerUp } from '@/components/NoteImageLightbox';

export default function NoteContentDisplay({
    value,
    className = '',
}: {
    value: string;
    className?: string;
}) {
    const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
    const parts = useMemo(() => splitNoteContent(value), [value]);

    if (parts.length === 0) return null;

    return (
        <>
            <div className={`whitespace-pre-wrap text-sm text-slate-300 ${className}`}>
                {parts.map((part, index) => {
                    if (part.type === 'image') {
                        return (
                            <span
                                key={`${part.url}-${index}`}
                                className="inline-note-image-wrap"
                                onPointerUp={(event) => handleNoteImagePointerUp(event, setLightbox)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setLightbox({ url: part.url, alt: part.alt });
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Tap to expand image"
                            >
                                <img src={part.url} alt={part.alt} className="inline-note-image" draggable={false} />
                            </span>
                        );
                    }
                    return <span key={`text-${index}`}>{part.text}</span>;
                })}
            </div>
            <NoteImageLightbox
                url={lightbox?.url ?? null}
                alt={lightbox?.alt}
                onClose={() => setLightbox(null)}
            />
        </>
    );
}
