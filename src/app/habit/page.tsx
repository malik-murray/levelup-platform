'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type Habit = {
    id: string;
    name: string;
    category: 'physical' | 'mental' | 'spiritual';
    icon: string;
    status: 'checked' | 'half' | 'missed';
};

type Priority = {
    id: string;
    text: string;
    completed: boolean;
};

type Task = {
    id: string;
    title: string;
    isDone: boolean;
};

type DailyScore = {
    overall: number;
    physical: number;
    mental: number;
    spiritual: number;
    grade: string;
};

export default function HabitPage() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Mock data
    const [habits, setHabits] = useState<Habit[]>([
        { id: '1', name: 'Morning Workout', category: 'physical', icon: '💪', status: 'missed' },
        { id: '2', name: 'Meditation', category: 'mental', icon: '🧘', status: 'checked' },
        { id: '3', name: 'Prayer', category: 'spiritual', icon: '🙏', status: 'half' },
        { id: '4', name: 'Read 30 mins', category: 'mental', icon: '📚', status: 'missed' },
        { id: '5', name: 'Journal', category: 'mental', icon: '✍️', status: 'checked' },
        { id: '6', name: 'Gratitude', category: 'spiritual', icon: '🙌', status: 'checked' },
    ]);

    const [priorities, setPriorities] = useState<Priority[]>([
        { id: '1', text: 'Complete Q1 project proposal', completed: false },
        { id: '2', text: 'Call mom', completed: true },
        { id: '3', text: 'Review budget for this month', completed: false },
    ]);

    const [tasks, setTasks] = useState<Task[]>([
        { id: '1', title: 'Email client follow-up', isDone: false },
        { id: '2', title: 'Grocery shopping', isDone: true },
        { id: '3', title: 'Update resume', isDone: false },
    ]);

    const [newTask, setNewTask] = useState('');
    const [newPriority1, setNewPriority1] = useState('');
    const [newPriority2, setNewPriority2] = useState('');
    const [newPriority3, setNewPriority3] = useState('');

    // Calculate daily score
    const calculateScore = (): DailyScore => {
        const physicalHabits = habits.filter(h => h.category === 'physical');
        const mentalHabits = habits.filter(h => h.category === 'mental');
        const spiritualHabits = habits.filter(h => h.category === 'spiritual');

        const getCategoryScore = (categoryHabits: Habit[]) => {
            let points = 0;
            categoryHabits.forEach(h => {
                if (h.status === 'checked') points += 1;
                else if (h.status === 'half') points += 0.5;
            });
            return categoryHabits.length > 0 ? Math.round((points / categoryHabits.length) * 100) : 0;
        };

        const physical = getCategoryScore(physicalHabits);
        const mental = getCategoryScore(mentalHabits);
        const spiritual = getCategoryScore(spiritualHabits);

        const overall = Math.round((physical + mental + spiritual) / 3);

        let grade = 'F';
        if (overall >= 90) grade = 'A';
        else if (overall >= 80) grade = 'B';
        else if (overall >= 70) grade = 'C';
        else if (overall >= 60) grade = 'D';

        return { overall, physical, mental, spiritual, grade };
    };

    const score = calculateScore();

    const handleHabitClick = (id: string) => {
        setHabits(prev => prev.map(h => {
            if (h.id === id) {
                if (h.status === 'missed') return { ...h, status: 'half' };
                if (h.status === 'half') return { ...h, status: 'checked' };
                return { ...h, status: 'missed' };
            }
            return h;
        }));
    };

    const handlePriorityToggle = (id: string) => {
        setPriorities(prev => prev.map(p => p.id === id ? { ...p, completed: !p.completed } : p));
    };

    const handleTaskToggle = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !t.isDone } : t));
    };

    const handleAddTask = () => {
        if (newTask.trim()) {
            setTasks(prev => [...prev, { id: Date.now().toString(), title: newTask.trim(), isDone: false }]);
            setNewTask('');
        }
    };

    const handleUpdatePriorities = () => {
        const updated: Priority[] = [
            { id: '1', text: newPriority1 || priorities[0]?.text || '', completed: priorities[0]?.completed || false },
            { id: '2', text: newPriority2 || priorities[1]?.text || '', completed: priorities[1]?.completed || false },
            { id: '3', text: newPriority3 || priorities[2]?.text || '', completed: priorities[2]?.completed || false },
        ].filter(p => p.text.trim());
        if (updated.length > 0) setPriorities(updated);
        setNewPriority1('');
        setNewPriority2('');
        setNewPriority3('');
    };

    const categoryColors = {
        physical: 'border-blue-500/30 bg-blue-950/30',
        mental: 'border-purple-500/30 bg-purple-950/30',
        spiritual: 'border-amber-500/30 bg-amber-950/30',
    };

    const getStatusEmoji = (status: string) => {
        if (status === 'checked') return '✅';
        if (status === 'half') return '🥑';
        return '⚪';
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
                            <h1 className="text-xl font-semibold text-amber-400">Habit Tracker</h1>
                            <p className="text-xs text-slate-400 mt-0.5">LevelUp Player One</p>
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
            <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
                {/* Today's Date & Score Card */}
                <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-950 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{today}</h2>
                            <p className="text-sm text-slate-400 mt-1">Today's Progress</p>
                        </div>
                        <div className="text-right">
                            <div className="text-5xl font-bold text-amber-400">{score.overall}</div>
                            <div className="text-2xl font-semibold text-amber-300 mt-1">Grade: {score.grade}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-center">
                            <div className="text-xs text-blue-300 mb-1">Physical</div>
                            <div className="text-2xl font-bold text-blue-400">{score.physical}</div>
                        </div>
                        <div className="rounded-md border border-purple-500/30 bg-purple-950/20 p-3 text-center">
                            <div className="text-xs text-purple-300 mb-1">Mental</div>
                            <div className="text-2xl font-bold text-purple-400">{score.mental}</div>
                        </div>
                        <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-center">
                            <div className="text-xs text-amber-300 mb-1">Spiritual</div>
                            <div className="text-2xl font-bold text-amber-400">{score.spiritual}</div>
                        </div>
                    </div>
                </div>

                {/* Top 3 Priorities */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h3 className="text-sm font-semibold mb-3">Top 3 Priorities</h3>
                    <div className="space-y-2 mb-3">
                        {priorities.map((priority, idx) => (
                            <div key={priority.id} className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePriorityToggle(priority.id)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                        priority.completed
                                            ? 'bg-amber-400 border-amber-400'
                                            : 'border-slate-600'
                                    }`}
                                >
                                    {priority.completed && <span className="text-black text-xs">✓</span>}
                                </button>
                                <span className={`flex-1 text-sm ${priority.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                    {idx + 1}. {priority.text}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 text-xs">
                        <input
                            type="text"
                            placeholder="Priority 1"
                            value={newPriority1}
                            onChange={e => setNewPriority1(e.target.value)}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                            onKeyDown={e => e.key === 'Enter' && handleUpdatePriorities()}
                        />
                        <input
                            type="text"
                            placeholder="Priority 2"
                            value={newPriority2}
                            onChange={e => setNewPriority2(e.target.value)}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                            onKeyDown={e => e.key === 'Enter' && handleUpdatePriorities()}
                        />
                        <input
                            type="text"
                            placeholder="Priority 3"
                            value={newPriority3}
                            onChange={e => setNewPriority3(e.target.value)}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                            onKeyDown={e => e.key === 'Enter' && handleUpdatePriorities()}
                        />
                        <button
                            onClick={handleUpdatePriorities}
                            className="rounded-md bg-amber-400 px-3 py-1 text-black font-semibold hover:bg-amber-300"
                        >
                            Update
                        </button>
                    </div>
                </div>

                {/* Habits by Category */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {(['physical', 'mental', 'spiritual'] as const).map(category => {
                        const categoryHabits = habits.filter(h => h.category === category);
                        return (
                            <div key={category} className={`rounded-lg border ${categoryColors[category]} p-4`}>
                                <h3 className="text-sm font-semibold mb-3 capitalize">{category} Habits</h3>
                                <div className="space-y-2">
                                    {categoryHabits.map(habit => (
                                        <button
                                            key={habit.id}
                                            onClick={() => handleHabitClick(habit.id)}
                                            className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-900/50 transition-colors text-left"
                                        >
                                            <span className="text-lg">{habit.icon}</span>
                                            <span className="flex-1 text-sm text-slate-200">{habit.name}</span>
                                            <span className="text-lg">{getStatusEmoji(habit.status)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Tasks */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h3 className="text-sm font-semibold mb-3">Tasks</h3>
                    <div className="space-y-2 mb-3">
                        {tasks.map(task => (
                            <div key={task.id} className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTaskToggle(task.id)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                        task.isDone ? 'bg-amber-400 border-amber-400' : 'border-slate-600'
                                    }`}
                                >
                                    {task.isDone && <span className="text-black text-xs">✓</span>}
                                </button>
                                <span className={`flex-1 text-sm ${task.isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                    {task.title}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add a task..."
                            value={newTask}
                            onChange={e => setNewTask(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        />
                        <button
                            onClick={handleAddTask}
                            className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
