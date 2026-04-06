'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import { neon } from '../neonTheme';
import CollapsiblePanel from './CollapsiblePanel';

function adjustTextareaHeight(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
}

type DailyNotesContent = {
    notes: string | null;
    lessons: string | null;
    feelings: string | null;
    ideas: string | null;
    reflection: string | null;
};

const SECTIONS = [
    { key: 'notes' as const, title: 'Notes', placeholder: 'General notes...' },
    { key: 'lessons' as const, title: 'Lessons', placeholder: 'What did you learn today?' },
    { key: 'feelings' as const, title: 'Feelings', placeholder: 'How are you feeling?' },
    { key: 'ideas' as const, title: 'Ideas', placeholder: 'Any ideas or insights?' },
    { key: 'reflection' as const, title: 'Reflection', placeholder: 'End of day reflection...' },
];

export default function DashboardNotesSection({
    selectedDate,
    userId,
}: {
    selectedDate: Date;
    userId: string | null;
}) {
    const [notesOpen, setNotesOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['notes', 'lessons', 'feelings', 'ideas', 'reflection']));
    const [content, setContent] = useState<DailyNotesContent>({
        notes: null,
        lessons: null,
        feelings: null,
        ideas: null,
        reflection: null,
    });
    const [loading, setLoading] = useState(true);
    const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

    useEffect(() => {
        if (userId) {
            loadContent();
        }
    }, [selectedDate, userId]);

    useEffect(() => {
        SECTIONS.forEach(({ key }) => {
            if (expandedSections.has(key)) adjustTextareaHeight(textareaRefs.current[key]);
        });
    }, [content, expandedSections]);

    const loadContent = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);
            const { data } = await supabase
                .from('habit_daily_content')
                .select('notes, lessons, feelings, ideas, reflection')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            setContent({
                notes: data?.notes ?? null,
                lessons: data?.lessons ?? null,
                feelings: (data as { feelings?: string } | null)?.feelings ?? null,
                ideas: data?.ideas ?? null,
                reflection: data?.reflection ?? null,
            });
        } catch (error) {
            console.error('Error loading notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveField = async (field: keyof DailyNotesContent, value: string | null) => {
        if (!userId) return;
        const dateStr = formatDate(selectedDate);
        const updated = { ...content, [field]: value ?? null };
        try {
            const { data: existing } = await supabase
                .from('habit_daily_content')
                .select('distractions')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            await supabase
                .from('habit_daily_content')
                .upsert(
                    {
                        user_id: userId,
                        date: dateStr,
                        notes: updated.notes || null,
                        lessons: updated.lessons || null,
                        feelings: updated.feelings ?? null,
                        ideas: updated.ideas ?? null,
                        reflection: updated.reflection || null,
                        distractions: existing?.distractions ?? null,
                    },
                    { onConflict: 'user_id,date' }
                );
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    };

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const getSummary = (text: string | null | undefined): string | null => {
        if (!text || !text.trim()) return null;
        const len = text.trim().length;
        if (len < 60) return `${len} chars`;
        return `${text.trim().split(/\s+/).filter(Boolean).length} words`;
    };

    if (!userId) return null;

    return (
        <div className={`${neon.widget} min-w-0 overflow-hidden p-0`}>
            <button
                type="button"
                onClick={() => setNotesOpen(!notesOpen)}
                aria-expanded={notesOpen}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#ff9d00]/5"
            >
                <h2
                    className="text-2xl font-bold text-[#ffe066]"
                    style={{ textShadow: '0 0 14px rgba(255,200,80,0.25)' }}
                >
                    Daily Notes
                </h2>
                <svg
                    className={`h-5 w-5 shrink-0 text-[#ff9d00] transition-transform duration-300 ease-out motion-reduce:transition-none ${notesOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <CollapsiblePanel open={notesOpen} className="border-t border-[#ff9d00]/25">
                <div>
                    {loading ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                    ) : (
                        SECTIONS.map((section) => {
                            const isExpanded = expandedSections.has(section.key);
                            const value = content[section.key] || '';
                            const summary = getSummary(value);

                            return (
                                <div key={section.key} className="border-b border-[#ff9d00]/15 last:border-b-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(section.key)}
                                        aria-expanded={isExpanded}
                                        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[#ff9d00]/5"
                                    >
                                        <span className="text-sm font-medium text-slate-200">{section.title}</span>
                                        <span className="flex items-center gap-2">
                                            {summary ? (
                                                <span className="text-xs text-slate-500">({summary})</span>
                                            ) : null}
                                            <svg
                                                className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ease-out motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </span>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-4 pb-3 pt-1">
                                            <textarea
                                                ref={(el) => {
                                                    textareaRefs.current[section.key] = el;
                                                    adjustTextareaHeight(el);
                                                }}
                                                value={value}
                                                onChange={(e) => {
                                                    setContent((prev) => ({ ...prev, [section.key]: e.target.value }));
                                                    adjustTextareaHeight(e.target);
                                                }}
                                                onBlur={(e) => saveField(section.key, e.target.value || null)}
                                                placeholder={section.placeholder}
                                                className="min-h-[80px] w-full resize-none overflow-hidden rounded-lg border border-[#ff9d00]/25 bg-[#03060f]/90 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-[#ff9d00]/55 focus:outline-none"
                                                rows={1}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </CollapsiblePanel>
        </div>
    );
}
