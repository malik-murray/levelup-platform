'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type Reflection = {
    id: string;
    rawText: string;
    tags: string[];
    createdAt: string;
    lessons?: string[];
    actions?: string[];
    affirmations?: string[];
    contentIdeas?: string[];
};

export default function ReflectionPage() {
    const [reflections, setReflections] = useState<Reflection[]>([
        {
            id: '1',
            rawText: 'Today I realized that consistency is more important than perfection. I missed my workout but still did 10 minutes of stretching. Small wins matter.',
            tags: ['mindset', 'habits'],
            createdAt: new Date().toLocaleDateString(),
            lessons: ['Progress > Perfection', 'Consistency builds momentum'],
            actions: ['Celebrate small wins', 'Focus on showing up daily'],
            affirmations: ['I am making progress every day'],
            contentIdeas: ['The Power of 10 Minutes', 'Building Consistency Through Small Wins'],
        },
        {
            id: '2',
            rawText: 'Had a difficult conversation with a team member. Realized I need to communicate my boundaries better. Growth comes from uncomfortable moments.',
            tags: ['relationships', 'growth'],
            createdAt: new Date(Date.now() - 86400000).toLocaleDateString(),
            lessons: ['Boundaries are healthy', 'Growth requires discomfort'],
            actions: ['Practice clear communication', 'Set boundaries early'],
            affirmations: ['I communicate with clarity and respect'],
        },
    ]);

    const [rawText, setRawText] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    const handleGenerateLessons = () => {
        if (!rawText.trim()) return;

        // Mock AI-generated content (stub for now)
        const mockLessons = [
            'Lesson 1: Extract key insight from reflection',
            'Lesson 2: Identify the core principle',
            'Lesson 3: Connect to personal growth',
        ];
        const mockActions = [
            'Action Step 1: Practical next step',
            'Action Step 2: Build on the insight',
            'Action Step 3: Create accountability',
        ];
        const mockAffirmations = [
            'I am growing through reflection',
            'I turn insights into action',
        ];
        const mockContentIdeas = [
            'Content Idea: How to turn reflections into lessons',
            'Content Idea: The power of daily journaling',
        ];

        const newReflection: Reflection = {
            id: Date.now().toString(),
            rawText: rawText.trim(),
            tags: tags,
            createdAt: new Date().toLocaleDateString(),
            lessons: mockLessons,
            actions: mockActions,
            affirmations: mockAffirmations,
            contentIdeas: mockContentIdeas,
        };

        setReflections(prev => [newReflection, ...prev]);
        setRawText('');
        setTags([]);
        setTagInput('');
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags(prev => [...prev, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    };

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Reflection → Lesson</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Turn thoughts into lessons</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
                {/* New Reflection Form */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">New Reflection</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Your Reflection</label>
                            <textarea
                                value={rawText}
                                onChange={e => setRawText(e.target.value)}
                                placeholder="Write or paste your reflection here..."
                                className="w-full h-48 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Tags (optional)</label>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-900/30 border border-amber-500/30 px-2 py-1 text-xs text-amber-300"
                                    >
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-amber-100"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    placeholder="Add tag (e.g., mindset, money, relationships)"
                                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                                />
                                <button
                                    onClick={handleAddTag}
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    Add Tag
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleGenerateLessons}
                            disabled={!rawText.trim()}
                            className="w-full rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Generate Lessons
                        </button>
                    </div>
                </div>

                {/* Recent Reflections */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Recent Reflections</h2>
                    <div className="space-y-6">
                        {reflections.map(reflection => (
                            <div key={reflection.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex gap-2 flex-wrap">
                                        {reflection.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="rounded-full bg-amber-900/30 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="text-xs text-slate-400">{reflection.createdAt}</span>
                                </div>
                                <p className="text-sm text-slate-300 mb-4 whitespace-pre-wrap">{reflection.rawText}</p>
                                {reflection.lessons && reflection.lessons.length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-xs font-semibold text-amber-400 mb-1">Lessons</h4>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                                            {reflection.lessons.map((lesson, idx) => (
                                                <li key={idx}>{lesson}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {reflection.actions && reflection.actions.length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-xs font-semibold text-purple-400 mb-1">Action Steps</h4>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                                            {reflection.actions.map((action, idx) => (
                                                <li key={idx}>{action}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {reflection.affirmations && reflection.affirmations.length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-xs font-semibold text-blue-400 mb-1">Affirmations</h4>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                                            {reflection.affirmations.map((affirmation, idx) => (
                                                <li key={idx}>{affirmation}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {reflection.contentIdeas && reflection.contentIdeas.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-emerald-400 mb-1">Content Ideas</h4>
                                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                                            {reflection.contentIdeas.map((idea, idx) => (
                                                <li key={idx}>{idea}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
