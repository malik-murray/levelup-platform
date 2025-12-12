'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type EmotionEntry = {
    id: string;
    emotion: string;
    intensity: number;
    trigger: string;
    notes: string;
    createdAt: string;
    tags: string[];
};

export default function EmotionsPage() {
    const [entries, setEntries] = useState<EmotionEntry[]>([
        {
            id: '1',
            emotion: 'Anxious',
            intensity: 7,
            trigger: 'Work deadline approaching',
            notes: 'Felt overwhelmed by multiple deadlines. Took a walk to clear my head.',
            createdAt: new Date().toLocaleDateString(),
            tags: ['work', 'stress'],
        },
        {
            id: '2',
            emotion: 'Grateful',
            intensity: 9,
            trigger: 'Received encouragement from a friend',
            notes: 'Really appreciated the support during a tough week.',
            createdAt: new Date(Date.now() - 86400000).toLocaleDateString(),
            tags: ['relationships'],
        },
        {
            id: '3',
            emotion: 'Peaceful',
            intensity: 8,
            trigger: 'Morning meditation',
            notes: 'Started the day with 20 minutes of meditation. Feeling centered and calm.',
            createdAt: new Date(Date.now() - 172800000).toLocaleDateString(),
            tags: ['spiritual', 'self-care'],
        },
    ]);

    const [showForm, setShowForm] = useState(false);
    const [emotion, setEmotion] = useState('');
    const [intensity, setIntensity] = useState(5);
    const [trigger, setTrigger] = useState('');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    const emotions = ['Anxious', 'Happy', 'Sad', 'Angry', 'Grateful', 'Peaceful', 'Excited', 'Frustrated', 'Content', 'Overwhelmed'];

    const handleSubmit = () => {
        if (!emotion.trim()) return;

        const newEntry: EmotionEntry = {
            id: Date.now().toString(),
            emotion: emotion.trim(),
            intensity,
            trigger: trigger.trim(),
            notes: notes.trim(),
            createdAt: new Date().toLocaleDateString(),
            tags,
        };

        setEntries(prev => [newEntry, ...prev]);
        setEmotion('');
        setIntensity(5);
        setTrigger('');
        setNotes('');
        setTags([]);
        setTagInput('');
        setShowForm(false);
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

    const getEmotionColor = (emotion: string) => {
        const emotionMap: Record<string, string> = {
            'Anxious': 'text-red-400 border-red-500/30 bg-red-950/20',
            'Happy': 'text-yellow-400 border-yellow-500/30 bg-yellow-950/20',
            'Sad': 'text-blue-400 border-blue-500/30 bg-blue-950/20',
            'Angry': 'text-orange-400 border-orange-500/30 bg-orange-950/20',
            'Grateful': 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
            'Peaceful': 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
            'Excited': 'text-pink-400 border-pink-500/30 bg-pink-950/20',
            'Frustrated': 'text-red-400 border-red-500/30 bg-red-950/20',
            'Content': 'text-green-400 border-green-500/30 bg-green-950/20',
            'Overwhelmed': 'text-purple-400 border-purple-500/30 bg-purple-950/20',
        };
        return emotionMap[emotion] || 'text-slate-400 border-slate-500/30 bg-slate-950/20';
    };

    const getSuggestedVerse = (emotion: string) => {
        const verseMap: Record<string, string> = {
            'Anxious': 'Philippians 4:6-7 - "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God."',
            'Grateful': '1 Thessalonians 5:18 - "Give thanks in all circumstances; for this is God\'s will for you in Christ Jesus."',
            'Peaceful': 'John 14:27 - "Peace I leave with you; my peace I give you. I do not give to you as the world gives."',
            'Sad': 'Psalm 34:18 - "The Lord is close to the brokenhearted and saves those who are crushed in spirit."',
        };
        return verseMap[emotion] || 'Take a moment to reflect on this emotion and what it might be teaching you.';
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
                            <h1 className="text-xl font-semibold text-amber-400">Emotional Tracker</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Log emotions, triggers, and insights</p>
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
                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <Link
                        href="/emotions/test"
                        className="rounded-md border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-950/30 transition-colors"
                    >
                        📊 Take Emotional Assessment
                    </Link>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition-colors"
                    >
                        {showForm ? 'Cancel' : '+ Log Emotion'}
                    </button>
                </div>

                {/* Log Emotion Form */}
                {showForm && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                        <h2 className="text-lg font-semibold mb-4">Log Emotion</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Emotion *</label>
                                <select
                                    value={emotion}
                                    onChange={e => setEmotion(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                                >
                                    <option value="">Select an emotion...</option>
                                    {emotions.map(e => (
                                        <option key={e} value={e}>{e}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Intensity: {intensity}/10
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={intensity}
                                    onChange={e => setIntensity(parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Low</span>
                                    <span>High</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Trigger / Context</label>
                                <input
                                    type="text"
                                    value={trigger}
                                    onChange={e => setTrigger(e.target.value)}
                                    placeholder="What triggered this emotion?"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional thoughts, coping strategies, or observations..."
                                    className="w-full h-32 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
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
                                        placeholder="Add tag (e.g., work, family, health)"
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
                                onClick={handleSubmit}
                                disabled={!emotion.trim()}
                                className="w-full rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Save Entry
                            </button>
                        </div>
                    </div>
                )}

                {/* Recent Entries */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Recent Entries</h2>
                    <div className="space-y-4">
                        {entries.map(entry => (
                            <div key={entry.id} className={`rounded-md border p-4 ${getEmotionColor(entry.emotion)}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-semibold">{entry.emotion}</span>
                                        <span className="text-sm text-slate-300">Intensity: {entry.intensity}/10</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{entry.createdAt}</span>
                                </div>
                                {entry.trigger && (
                                    <p className="text-sm text-slate-300 mb-2">
                                        <span className="font-medium">Trigger:</span> {entry.trigger}
                                    </p>
                                )}
                                {entry.notes && (
                                    <p className="text-sm text-slate-300 mb-2">{entry.notes}</p>
                                )}
                                {entry.tags.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {entry.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="rounded-full bg-amber-900/30 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Suggested Verse/Lesson */}
                                <div className="mt-3 pt-3 border-t border-slate-700">
                                    <p className="text-xs font-semibold text-amber-400 mb-1">Suggested Verse/Lesson:</p>
                                    <p className="text-xs text-slate-300 italic">{getSuggestedVerse(entry.emotion)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
