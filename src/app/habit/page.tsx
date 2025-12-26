'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@auth/supabaseClient';
import {
    formatDate,
    getDatesInMonth,
    getMonthRange,
    isSameDay,
    getVisualScore,
    getGrade,
    type Category,
    type TimeOfDay,
    type HabitStatus,
} from '@/lib/habitHelpers';
import LifeTrackerHome from './components/LifeTrackerHome';

type Tab = 'home' | 'calendar' | 'daily' | 'statistics' | 'goals' | 'habits';

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: Category;
    time_of_day: TimeOfDay | null;
    goal_id: string | null;
    is_bad_habit: boolean;
    is_active: boolean;
};

type HabitEntry = {
    id: string;
    habit_template_id: string;
    date: string;
    status: HabitStatus;
};

type Priority = {
    id: string;
    text: string;
    category: Category | null;
    time_of_day: TimeOfDay | null;
    completed: boolean;
    goal_id: string | null;
};

type Todo = {
    id: string;
    title: string;
    category: Category | null;
    time_of_day: TimeOfDay | null;
    is_done: boolean;
    goal_id: string | null;
};

type DailyContent = {
    lessons: string | null;
    ideas: string | null;
    notes: string | null;
    distractions: string | null;
    reflection: string | null;
};

type DailyScore = {
    score_overall: number;
    grade: string;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
};

type CalendarDay = {
    date: Date;
    score: DailyScore | null;
};

export default function HabitPage() {
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    
    // Data
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [dailyContent, setDailyContent] = useState<DailyContent | null>(null);
    const [dailyScores, setDailyScores] = useState<Map<string, DailyScore>>(new Map());
    const [goals, setGoals] = useState<any[]>([]);

    // Load data
    useEffect(() => {
        loadData();
    }, [selectedDate, currentMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const dateStr = formatDate(selectedDate);
            const { start, end } = getMonthRange(currentMonth);
            const monthStartStr = formatDate(start);
            const monthEndStr = formatDate(end);

            // Load habit templates (both good and bad habits)
            const { data: templates } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order');

            // Load habit entries for the month
            const { data: entries } = await supabase
                .from('habit_daily_entries')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', monthStartStr)
                .lte('date', monthEndStr);

            // Load priorities for selected date
            const { data: prioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .order('sort_order');

            // Load todos for selected date
            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .order('created_at');

            // Load daily content for selected date
            const { data: contentData } = await supabase
                .from('habit_daily_content')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .single();

            // Load goals for linking
            const { data: goalsData } = await supabase
                .from('habit_goals')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .order('name');

            // Load daily scores for the month
            const { data: scoresData } = await supabase
                .from('habit_daily_scores')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', monthStartStr)
                .lte('date', monthEndStr);

            setHabitTemplates(templates || []);
            setHabitEntries(entries || []);
            setPriorities(prioritiesData || []);
            setTodos(todosData || []);
            setDailyContent(contentData || null);
            setGoals(goalsData || []);

            // Map scores by date
            const scoresMap = new Map<string, DailyScore>();
            scoresData?.forEach(score => {
                scoresMap.set(score.date, score);
            });
            setDailyScores(scoresMap);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calendarDays = getDatesInMonth(currentMonth).map(date => ({
        date,
        score: dailyScores.get(formatDate(date)) || null,
    }));

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            if (direction === 'prev') {
                newDate.setMonth(prev.getMonth() - 1);
            } else {
                newDate.setMonth(prev.getMonth() + 1);
            }
            return newDate;
        });
    };

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="flex gap-1">
                        {(['home', 'calendar', 'daily', 'statistics', 'goals', 'habits'] as Tab[]).map(tab => (
                                <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                                    activeTab === tab
                                        ? 'border-b-2 border-amber-400 text-amber-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                {tab === 'home' ? 'Home' : tab === 'calendar' ? 'Calendar' : tab === 'daily' ? 'Daily' : tab === 'statistics' ? 'Statistics/Streaks' : tab === 'goals' ? 'Goals & Milestones' : 'Habits/Bad Habits'}
                                </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-6 py-6">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading...</div>
                ) : activeTab === 'home' ? (
                    <LifeTrackerHome />
                ) : activeTab === 'calendar' ? (
                    <CalendarView
                        currentMonth={currentMonth}
                        calendarDays={calendarDays}
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        onMonthChange={navigateMonth}
                    />
                ) : activeTab === 'daily' ? (
                    <DailyView
                        date={selectedDate}
                        habitTemplates={habitTemplates}
                        habitEntries={habitEntries}
                        priorities={priorities}
                        todos={todos}
                        dailyContent={dailyContent}
                        goals={goals}
                        onDataChange={loadData}
                    />
                ) : activeTab === 'statistics' ? (
                    <StatisticsView dailyScores={dailyScores} />
                ) : activeTab === 'goals' ? (
                    <GoalsView />
                ) : (
                    <HabitsManagementView
                        habitTemplates={habitTemplates}
                        onDataChange={loadData}
                    />
                )}
            </div>
        </main>
    );
}

// Calendar View Component
function CalendarView({
    currentMonth,
    calendarDays,
    selectedDate,
    onDateSelect,
    onMonthChange,
}: {
    currentMonth: Date;
    calendarDays: CalendarDay[];
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    onMonthChange: (direction: 'prev' | 'next') => void;
}) {
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get first day of month to determine offset
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();

    return (
        <div className="space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => onMonthChange('prev')}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    ← Prev
                </button>
                <h2 className="text-xl font-semibold">{monthName}</h2>
                        <button
                    onClick={() => onMonthChange('next')}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                    Next →
                        </button>
                    </div>

            {/* Calendar Grid */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-900">
                    {weekDays.map(day => (
                        <div key={day} className="p-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: startOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square border border-slate-100 dark:border-slate-800" />
                    ))}

                    {/* Actual days */}
                    {calendarDays.map(({ date, score }) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isToday = isSameDay(date, new Date());
                        const visualScore = score ? getVisualScore(score.score_overall) : '⬜⬜⬜⬜⬜';

                        return (
                                        <button
                                key={formatDate(date)}
                                onClick={() => onDateSelect(date)}
                                className={`aspect-square border border-slate-200 dark:border-slate-800 p-2 text-left transition-colors ${
                                    isSelected
                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                                } ${isToday ? 'ring-2 ring-amber-400' : ''}`}
                            >
                                <div className="text-xs font-medium mb-1">{date.getDate()}</div>
                                {score && (
                                    <>
                                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-0.5">
                                            {score.score_overall}
                                        </div>
                                        <div className="text-xs mb-0.5">{score.grade}</div>
                                        <div className="text-[10px] leading-tight">{visualScore}</div>
                                    </>
                                )}
                                        </button>
                        );
                    })}
                </div>
                            </div>
                    </div>
    );
}

// Daily View Component
function DailyView({
    date,
    habitTemplates,
    habitEntries,
    priorities,
    todos,
    dailyContent,
    goals,
    onDataChange,
}: {
    date: Date;
    habitTemplates: HabitTemplate[];
    habitEntries: HabitEntry[];
    priorities: Priority[];
    todos: Todo[];
    dailyContent: DailyContent | null;
    goals: any[];
    onDataChange: () => void;
}) {
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitIcon, setNewHabitIcon] = useState('📝');
    const [newHabitCategory, setNewHabitCategory] = useState<Category>('mental');
    const [newHabitTimeOfDay, setNewHabitTimeOfDay] = useState<TimeOfDay | null>(null);
    const [newPriority, setNewPriority] = useState('');
    const [newPriorityCategory, setNewPriorityCategory] = useState<Category | null>(null);
    const [newPriorityTimeOfDay, setNewPriorityTimeOfDay] = useState<TimeOfDay | null>(null);
    const [newPriorityGoalId, setNewPriorityGoalId] = useState<string | null>(null);
    const [newTodo, setNewTodo] = useState('');
    const [newTodoCategory, setNewTodoCategory] = useState<Category | null>(null);
    const [newTodoTimeOfDay, setNewTodoTimeOfDay] = useState<TimeOfDay | null>(null);
    const [newTodoGoalId, setNewTodoGoalId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState<DailyContent>({
        lessons: dailyContent?.lessons || '',
        ideas: dailyContent?.ideas || '',
        notes: dailyContent?.notes || '',
        distractions: dailyContent?.distractions || '',
        reflection: dailyContent?.reflection || '',
    });

    const dateStr = formatDate(date);
    const todayStr = formatDate(new Date());

    // Get entries for selected date
    const dateEntries = habitEntries.filter(e => e.date === dateStr);
    const habitsWithEntries = habitTemplates.map(template => {
        const entry = dateEntries.find(e => e.habit_template_id === template.id);
        return {
            ...template,
            entry: entry || null,
            status: (entry?.status || 'missed') as HabitStatus,
        };
    });

    // Calculate scores
    const habitsScore = calculateHabitsScore(habitsWithEntries);
    const prioritiesScore = calculatePrioritiesScore(priorities);
    const todosScore = calculateTodosScore(todos);
    const overallScore = Math.round(habitsScore * 0.40 + prioritiesScore * 0.35 + todosScore * 0.25);
    const grade = getGrade(overallScore);
    
    // Import getGrade from helpers instead of defining locally

    // Category scores
    const physicalScore = calculateCategoryScore([...habitsWithEntries, ...priorities, ...todos], 'physical');
    const mentalScore = calculateCategoryScore([...habitsWithEntries, ...priorities, ...todos], 'mental');
    const spiritualScore = calculateCategoryScore([...habitsWithEntries, ...priorities, ...todos], 'spiritual');

    // Time of day scores
    const morningScore = calculateTimeOfDayScore([...habitsWithEntries, ...priorities, ...todos], 'morning');
    const afternoonScore = calculateTimeOfDayScore([...habitsWithEntries, ...priorities, ...todos], 'afternoon');
    const eveningScore = calculateTimeOfDayScore([...habitsWithEntries, ...priorities, ...todos], 'evening');

    const handleHabitToggle = async (templateId: string, currentStatus: HabitStatus) => {
        const nextStatus: HabitStatus = currentStatus === 'missed' ? 'half' : currentStatus === 'half' ? 'checked' : 'missed';
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const existingEntry = dateEntries.find(e => e.habit_template_id === templateId);
            
            if (existingEntry) {
                await supabase
                    .from('habit_daily_entries')
                    .update({ status: nextStatus })
                    .eq('id', existingEntry.id);
            } else {
                await supabase
                    .from('habit_daily_entries')
                    .insert({
                        user_id: user.id,
                        date: dateStr,
                        habit_template_id: templateId,
                        status: nextStatus,
                    });
            }
            
            await saveDailyScore();
            onDataChange();
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    };

    const handleAddHabit = async () => {
        if (!newHabitName.trim()) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_templates')
                .insert({
                    user_id: user.id,
                    name: newHabitName,
                    icon: newHabitIcon,
                    category: newHabitCategory,
                    time_of_day: newHabitTimeOfDay,
                    is_active: true,
                });

            setNewHabitName('');
            setNewHabitIcon('📝');
            setNewHabitCategory('mental');
            setNewHabitTimeOfDay(null);
            onDataChange();
        } catch (error) {
            console.error('Error adding habit:', error);
        }
    };

    const handleAddPriority = async () => {
        if (!newPriority.trim()) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_daily_priorities')
                .insert({
                    user_id: user.id,
                    date: dateStr,
                    text: newPriority,
                    category: newPriorityCategory,
                    time_of_day: newPriorityTimeOfDay,
                    goal_id: newPriorityGoalId,
                    completed: false,
                });

            setNewPriority('');
            setNewPriorityCategory(null);
            setNewPriorityTimeOfDay(null);
            setNewPriorityGoalId(null);
            await saveDailyScore();
            onDataChange();
        } catch (error) {
            console.error('Error adding priority:', error);
        }
    };

    const handleTogglePriority = async (id: string, completed: boolean) => {
        try {
            await supabase
                .from('habit_daily_priorities')
                .update({ completed: !completed })
                .eq('id', id);
            
            await saveDailyScore();
            onDataChange();
        } catch (error) {
            console.error('Error updating priority:', error);
        }
    };

    const handleAddTodo = async () => {
        if (!newTodo.trim()) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_daily_todos')
                .insert({
                    user_id: user.id,
                    date: dateStr,
                    title: newTodo,
                    category: newTodoCategory,
                    time_of_day: newTodoTimeOfDay,
                    goal_id: newTodoGoalId,
                    is_done: false,
                });

            setNewTodo('');
            setNewTodoCategory(null);
            setNewTodoTimeOfDay(null);
            setNewTodoGoalId(null);
            await saveDailyScore();
            onDataChange();
        } catch (error) {
            console.error('Error adding todo:', error);
        }
    };

    const handleToggleTodo = async (id: string, isDone: boolean) => {
        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: !isDone })
                .eq('id', id);
            
            await saveDailyScore();
            onDataChange();
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    };

    const handleSaveContent = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_daily_content')
                .upsert({
                    user_id: user.id,
                    date: dateStr,
                    ...editingContent,
                });
            
            onDataChange();
        } catch (error) {
            console.error('Error saving content:', error);
        }
    };

    const saveDailyScore = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_daily_scores')
                .upsert({
                    user_id: user.id,
                    date: dateStr,
                    score_overall: overallScore,
                    grade: grade,
                    score_habits: habitsScore,
                    score_priorities: prioritiesScore,
                    score_todos: todosScore,
                    score_physical: physicalScore,
                    score_mental: mentalScore,
                    score_spiritual: spiritualScore,
                    score_morning: morningScore,
                    score_afternoon: afternoonScore,
                    score_evening: eveningScore,
                });
        } catch (error) {
            console.error('Error saving score:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Score Card */}
            <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-slate-950 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">Daily Progress</p>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-bold text-amber-400">{overallScore}</div>
                        <div className="text-2xl font-semibold text-amber-300 mt-1">Grade: {grade}</div>
                        <div className="text-lg mt-2">{getVisualScore(overallScore)}</div>
                    </div>
                </div>
                
                {/* Component Scores */}
                <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
                    <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Habits (40%)</div>
                        <div className="text-2xl font-bold text-blue-400">{habitsScore}</div>
                    </div>
                    <div className="rounded-md border border-purple-500/30 bg-purple-950/20 p-3 text-center">
                        <div className="text-xs text-purple-300 mb-1">Priorities (35%)</div>
                        <div className="text-2xl font-bold text-purple-400">{prioritiesScore}</div>
                    </div>
                    <div className="rounded-md border border-green-500/30 bg-green-950/20 p-3 text-center">
                        <div className="text-xs text-green-300 mb-1">Todos (25%)</div>
                        <div className="text-2xl font-bold text-green-400">{todosScore}</div>
                    </div>
                </div>

                {/* Category Scores */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Physical</div>
                        <div className="text-xl font-bold text-blue-400">{physicalScore}</div>
                    </div>
                    <div className="rounded-md border border-purple-500/30 bg-purple-950/20 p-3 text-center">
                        <div className="text-xs text-purple-300 mb-1">Mental</div>
                        <div className="text-xl font-bold text-purple-400">{mentalScore}</div>
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-center">
                        <div className="text-xs text-amber-300 mb-1">Spiritual</div>
                        <div className="text-xl font-bold text-amber-400">{spiritualScore}</div>
                    </div>
                </div>

                {/* Time of Day Scores */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-md border border-slate-500/30 bg-slate-950/20 p-3 text-center">
                        <div className="text-xs text-slate-300 mb-1">Morning</div>
                        <div className="text-xl font-bold text-slate-200">{morningScore}</div>
                    </div>
                    <div className="rounded-md border border-slate-500/30 bg-slate-950/20 p-3 text-center">
                        <div className="text-xs text-slate-300 mb-1">Afternoon</div>
                        <div className="text-xl font-bold text-slate-200">{afternoonScore}</div>
                    </div>
                    <div className="rounded-md border border-slate-500/30 bg-slate-950/20 p-3 text-center">
                        <div className="text-xs text-slate-300 mb-1">Evening</div>
                        <div className="text-xl font-bold text-slate-200">{eveningScore}</div>
                    </div>
                </div>
            </div>

            {/* Habits Section */}
            <HabitsSection
                habits={habitsWithEntries}
                onToggle={handleHabitToggle}
                onAdd={handleAddHabit}
                newHabitName={newHabitName}
                setNewHabitName={setNewHabitName}
                newHabitIcon={newHabitIcon}
                setNewHabitIcon={setNewHabitIcon}
                newHabitCategory={newHabitCategory}
                setNewHabitCategory={setNewHabitCategory}
                newHabitTimeOfDay={newHabitTimeOfDay}
                setNewHabitTimeOfDay={setNewHabitTimeOfDay}
            />

            {/* Priorities Section */}
            <PrioritiesSection
                priorities={priorities}
                goals={goals}
                onToggle={handleTogglePriority}
                onAdd={handleAddPriority}
                newPriority={newPriority}
                setNewPriority={setNewPriority}
                newPriorityCategory={newPriorityCategory}
                setNewPriorityCategory={setNewPriorityCategory}
                newPriorityTimeOfDay={newPriorityTimeOfDay}
                setNewPriorityTimeOfDay={setNewPriorityTimeOfDay}
                newPriorityGoalId={newPriorityGoalId}
                setNewPriorityGoalId={setNewPriorityGoalId}
            />

            {/* Todos Section */}
            <TodosSection
                todos={todos}
                goals={goals}
                onToggle={handleToggleTodo}
                onAdd={handleAddTodo}
                newTodo={newTodo}
                setNewTodo={setNewTodo}
                newTodoCategory={newTodoCategory}
                setNewTodoCategory={setNewTodoCategory}
                newTodoTimeOfDay={newTodoTimeOfDay}
                setNewTodoTimeOfDay={setNewTodoTimeOfDay}
                newTodoGoalId={newTodoGoalId}
                setNewTodoGoalId={setNewTodoGoalId}
            />

            {/* Daily Content Section */}
            <DailyContentSection
                content={editingContent}
                setContent={setEditingContent}
                onSave={handleSaveContent}
            />
        </div>
    );
}

// Helper functions for score calculations
function calculateHabitsScore(habits: Array<{ status: HabitStatus; is_bad_habit?: boolean }>): number {
    if (habits.length === 0) return 0;
    let points = 0;
    habits.forEach(h => {
        if (h.is_bad_habit) {
            // For bad habits: missed (avoided) = good, checked (did it) = bad
            if (h.status === 'missed') points += 1; // Avoided the bad habit = success
            else if (h.status === 'half') points += 0.5;
            // checked = did the bad habit = 0 points
        } else {
            // For good habits: checked = good, missed = bad
            if (h.status === 'checked') points += 1;
            else if (h.status === 'half') points += 0.5;
        }
    });
    return Math.round((points / habits.length) * 100);
}

function calculatePrioritiesScore(priorities: Priority[]): number {
    if (priorities.length === 0) return 0;
    const completed = priorities.filter(p => p.completed).length;
    return Math.round((completed / priorities.length) * 100);
}

function calculateTodosScore(todos: Todo[]): number {
    if (todos.length === 0) return 0;
    const completed = todos.filter(t => t.is_done).length;
    return Math.round((completed / todos.length) * 100);
}

function calculateCategoryScore(
    items: Array<{ category?: Category | null; status?: HabitStatus; completed?: boolean; is_done?: boolean }>,
    targetCategory: Category
): number {
    const categoryItems = items.filter(item => item.category === targetCategory);
    if (categoryItems.length === 0) return 0;
    
    let points = 0;
    categoryItems.forEach(item => {
        if (item.status === 'checked' || item.completed || item.is_done) points += 1;
        else if (item.status === 'half') points += 0.5;
    });
    
    return Math.round((points / categoryItems.length) * 100);
}

function calculateTimeOfDayScore(
    items: Array<{ time_of_day?: TimeOfDay | null; status?: HabitStatus; completed?: boolean; is_done?: boolean }>,
    targetTime: TimeOfDay
): number {
    const timeItems = items.filter(item => item.time_of_day === targetTime);
    if (timeItems.length === 0) return 0;
    
    let points = 0;
    timeItems.forEach(item => {
        if (item.status === 'checked' || item.completed || item.is_done) points += 1;
        else if (item.status === 'half') points += 0.5;
    });
    
    return Math.round((points / timeItems.length) * 100);
}

// Section Components
function HabitsSection({
    habits,
    onToggle,
    onAdd,
    newHabitName,
    setNewHabitName,
    newHabitIcon,
    setNewHabitIcon,
    newHabitCategory,
    setNewHabitCategory,
    newHabitTimeOfDay,
    setNewHabitTimeOfDay,
}: any) {
    const categoryColors = {
        physical: 'border-blue-500/30 bg-blue-950/30',
        mental: 'border-purple-500/30 bg-purple-950/30',
        spiritual: 'border-amber-500/30 bg-amber-950/30',
    };

    const getStatusEmoji = (status: HabitStatus) => {
        if (status === 'checked') return '✅';
        if (status === 'half') return '🥑';
        return '⚪';
    };

    const goodHabits = habits.filter((h: any) => !h.is_bad_habit);
    const badHabits = habits.filter((h: any) => h.is_bad_habit);
    
    const habitsByCategory = {
        physical: goodHabits.filter((h: any) => h.category === 'physical'),
        mental: goodHabits.filter((h: any) => h.category === 'mental'),
        spiritual: goodHabits.filter((h: any) => h.category === 'spiritual'),
    };
    
    const badHabitsByCategory = {
        physical: badHabits.filter((h: any) => h.category === 'physical'),
        mental: badHabits.filter((h: any) => h.category === 'mental'),
        spiritual: badHabits.filter((h: any) => h.category === 'spiritual'),
    };

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-base font-semibold mb-3 text-blue-400">Habits</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {(['physical', 'mental', 'spiritual'] as Category[]).map(category => (
                    <div key={category} className={`rounded-lg border ${categoryColors[category]} p-4`}>
                        <h4 className="text-xs font-semibold mb-2 capitalize">{category} Habits</h4>
                        <div className="space-y-2">
                            {habitsByCategory[category].map((habit: any) => (
                                <button
                                    key={habit.id}
                                    onClick={() => onToggle(habit.id, habit.status)}
                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-900/50 transition-colors text-left"
                                >
                                    <span className="text-lg">{habit.icon}</span>
                                    <span className="flex-1 text-sm text-slate-200">{habit.name}</span>
                                    {habit.time_of_day && (
                                        <span className="text-xs text-slate-400 capitalize">{habit.time_of_day}</span>
                                    )}
                                    <span className="text-lg">{getStatusEmoji(habit.status)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bad Habits Section */}
            {(badHabitsByCategory.physical.length > 0 || badHabitsByCategory.mental.length > 0 || badHabitsByCategory.spiritual.length > 0) && (
                <div className="mb-4">
                    <h3 className="text-xs font-semibold mb-2 text-red-400">Bad Habits (Avoid These)</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {(['physical', 'mental', 'spiritual'] as Category[]).map(category => {
                            if (badHabitsByCategory[category].length === 0) return null;
                            return (
                                <div key={`bad-${category}`} className={`rounded-lg border border-red-500/30 bg-red-950/30 p-4`}>
                                    <h4 className="text-xs font-semibold mb-2 capitalize text-red-300">{category} Bad Habits</h4>
                                    <div className="space-y-2">
                                        {badHabitsByCategory[category].map((habit: any) => {
                                            // For bad habits, invert the status display: missed = good (avoided), checked = bad (did it)
                                            const displayStatus = habit.status === 'missed' ? 'checked' : habit.status === 'checked' ? 'missed' : 'half';
                                            return (
                                                <button
                                                    key={habit.id}
                                                    onClick={() => onToggle(habit.id, habit.status)}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-900/50 transition-colors text-left"
                                                >
                                                    <span className="text-lg">{habit.icon}</span>
                                                    <span className="flex-1 text-sm text-slate-200">{habit.name}</span>
                                                    {habit.time_of_day && (
                                                        <span className="text-xs text-slate-400 capitalize">{habit.time_of_day}</span>
                                                    )}
                                                    <span className="text-lg" title={habit.status === 'missed' ? 'Avoided ✓' : habit.status === 'checked' ? 'Did it ✗' : 'Partial'}>
                                                        {getStatusEmoji(displayStatus)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add New Habit */}
            <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-blue-300 mb-2">Add New Habit</h4>
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        placeholder="Icon (emoji)"
                        value={newHabitIcon}
                        onChange={e => setNewHabitIcon(e.target.value)}
                        className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        maxLength={2}
                    />
                    <input
                        type="text"
                        placeholder="Habit name..."
                        value={newHabitName}
                        onChange={e => setNewHabitName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onAdd()}
                        className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    />
                    <select
                        value={newHabitCategory}
                        onChange={e => setNewHabitCategory(e.target.value as Category)}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    >
                        <option value="physical">Physical</option>
                        <option value="mental">Mental</option>
                        <option value="spiritual">Spiritual</option>
                    </select>
                    <select
                        value={newHabitTimeOfDay || ''}
                        onChange={e => setNewHabitTimeOfDay(e.target.value || null)}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    >
                        <option value="">Any Time</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                    </select>
                    <button
                        onClick={onAdd}
                        className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
}

function PrioritiesSection({
    priorities,
    goals,
    onToggle,
    onAdd,
    newPriority,
    setNewPriority,
    newPriorityCategory,
    setNewPriorityCategory,
    newPriorityTimeOfDay,
    setNewPriorityTimeOfDay,
    newPriorityGoalId,
    setNewPriorityGoalId,
}: any) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-base font-semibold mb-3 text-purple-400">Priorities</h3>
            <div className="space-y-2 mb-3">
                {priorities.map((priority: Priority) => {
                    const linkedGoal = goals.find((g: any) => g.id === priority.goal_id);
                    return (
                        <div key={priority.id} className="flex items-center gap-2">
                            <button
                                onClick={() => onToggle(priority.id, priority.completed)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    priority.completed
                                        ? 'bg-amber-400 border-amber-400'
                                        : 'border-slate-600'
                                }`}
                            >
                                {priority.completed && <span className="text-black text-xs">✓</span>}
                            </button>
                            <span className={`flex-1 text-sm ${priority.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                {priority.text}
                                {linkedGoal && (
                                    <span className="ml-2 text-xs text-slate-400">→ {linkedGoal.name}</span>
                                )}
                            </span>
                            {priority.category && (
                                <span className="text-xs text-slate-400 capitalize">{priority.category}</span>
                            )}
                            {priority.time_of_day && (
                                <span className="text-xs text-slate-400 capitalize">{priority.time_of_day}</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-4">
                <h4 className="text-sm font-medium text-purple-300 mb-2">Add Priority</h4>
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        placeholder="Add priority..."
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onAdd()}
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
                <select
                    value={newPriorityCategory || ''}
                    onChange={e => setNewPriorityCategory(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                >
                    <option value="">No Category</option>
                    <option value="physical">Physical</option>
                    <option value="mental">Mental</option>
                    <option value="spiritual">Spiritual</option>
                </select>
                <select
                    value={newPriorityTimeOfDay || ''}
                    onChange={e => setNewPriorityTimeOfDay(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                >
                    <option value="">Any Time</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                </select>
                <select
                    value={newPriorityGoalId || ''}
                    onChange={e => setNewPriorityGoalId(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    title="Link to goal"
                >
                    <option value="">No Goal</option>
                    {goals.map((goal: any) => (
                        <option key={goal.id} value={goal.id}>{goal.name}</option>
                    ))}
                </select>
                <button
                    onClick={onAdd}
                    className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    Add
                </button>
                </div>
            </div>
        </div>
    );
}

function TodosSection({
    todos,
    goals,
    onToggle,
    onAdd,
    newTodo,
    setNewTodo,
    newTodoCategory,
    setNewTodoCategory,
    newTodoTimeOfDay,
    setNewTodoTimeOfDay,
    newTodoGoalId,
    setNewTodoGoalId,
}: any) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-base font-semibold mb-3 text-green-400">To-Do List</h3>
            <div className="space-y-2 mb-3">
                {todos.map((todo: Todo) => {
                    const linkedGoal = goals.find((g: any) => g.id === todo.goal_id);
                    return (
                        <div key={todo.id} className="flex items-center gap-2">
                            <button
                                onClick={() => onToggle(todo.id, todo.is_done)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    todo.is_done ? 'bg-amber-400 border-amber-400' : 'border-slate-600'
                                }`}
                            >
                                {todo.is_done && <span className="text-black text-xs">✓</span>}
                            </button>
                            <span className={`flex-1 text-sm ${todo.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                {todo.title}
                                {linkedGoal && (
                                    <span className="ml-2 text-xs text-slate-400">→ {linkedGoal.name}</span>
                                )}
                            </span>
                            {todo.category && (
                                <span className="text-xs text-slate-400 capitalize">{todo.category}</span>
                            )}
                            {todo.time_of_day && (
                                <span className="text-xs text-slate-400 capitalize">{todo.time_of_day}</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-4">
                <h4 className="text-sm font-medium text-green-300 mb-2">Add Todo</h4>
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        placeholder="Add task..."
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onAdd()}
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
                <select
                    value={newTodoCategory || ''}
                    onChange={e => setNewTodoCategory(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                >
                    <option value="">No Category</option>
                    <option value="physical">Physical</option>
                    <option value="mental">Mental</option>
                    <option value="spiritual">Spiritual</option>
                </select>
                <select
                    value={newTodoTimeOfDay || ''}
                    onChange={e => setNewTodoTimeOfDay(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                >
                    <option value="">Any Time</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                </select>
                <select
                    value={newTodoGoalId || ''}
                    onChange={e => setNewTodoGoalId(e.target.value || null)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    title="Link to goal"
                >
                    <option value="">No Goal</option>
                    {goals.map((goal: any) => (
                        <option key={goal.id} value={goal.id}>{goal.name}</option>
                    ))}
                </select>
                <button
                    onClick={onAdd}
                    className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300"
                >
                    Add
                </button>
                </div>
            </div>
        </div>
    );
}

function DailyContentSection({
    content,
    setContent,
    onSave,
}: {
    content: DailyContent;
    setContent: (content: DailyContent) => void;
    onSave: () => void;
}) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-4">
            <h3 className="text-sm font-semibold mb-3">Daily Content</h3>
            
            <div>
                <label className="text-xs text-slate-400 mb-1 block">Lessons of the Day</label>
                <textarea
                    value={content.lessons || ''}
                    onChange={e => setContent({ ...content, lessons: e.target.value })}
                    onBlur={onSave}
                    placeholder="What did you learn today?"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm min-h-[60px]"
                />
            </div>

            <div>
                <label className="text-xs text-slate-400 mb-1 block">Ideas</label>
                <textarea
                    value={content.ideas || ''}
                    onChange={e => setContent({ ...content, ideas: e.target.value })}
                    onBlur={onSave}
                    placeholder="Any ideas or insights?"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm min-h-[60px]"
                />
            </div>

            <div>
                <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                <textarea
                    value={content.notes || ''}
                    onChange={e => setContent({ ...content, notes: e.target.value })}
                    onBlur={onSave}
                    placeholder="General notes..."
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm min-h-[60px]"
                />
            </div>

            <div>
                <label className="text-xs text-slate-400 mb-1 block">Distractions/Bad Habits</label>
                <textarea
                    value={content.distractions || ''}
                    onChange={e => setContent({ ...content, distractions: e.target.value })}
                    onBlur={onSave}
                    placeholder="What distracted you or what bad habits did you notice?"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm min-h-[60px]"
                />
            </div>

            <div>
                <label className="text-xs text-slate-400 mb-1 block">Reflection</label>
                <textarea
                    value={content.reflection || ''}
                    onChange={e => setContent({ ...content, reflection: e.target.value })}
                    onBlur={onSave}
                    placeholder="End of day reflection..."
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm min-h-[80px]"
                />
            </div>
        </div>
    );
}

function StatisticsView({ dailyScores }: { dailyScores: Map<string, DailyScore> }) {
    const scoresArray = Array.from(dailyScores.values());
    
    if (scoresArray.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                No data yet. Start tracking your habits to see statistics!
            </div>
        );
    }

    // Calculate statistics
    const overallScores = scoresArray.map(s => s.score_overall);
    const avgScore = Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length);
    const maxScore = Math.max(...overallScores);
    const minScore = Math.min(...overallScores);
    
    // Calculate current streak
    const sortedDates = Array.from(dailyScores.keys()).sort().reverse();
    let currentStreak = 0;
    const today = formatDate(new Date());
    let checkDate = new Date();
    
    for (let i = 0; i < 365; i++) {
        const dateStr = formatDate(checkDate);
        const score = dailyScores.get(dateStr);
        if (score && score.score_overall >= 60) { // D or better
            currentStreak++;
        } else {
            break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    sortedDates.forEach(dateStr => {
        const score = dailyScores.get(dateStr);
        if (score && score.score_overall >= 60) {
            tempStreak++;
            longestStreak = Math.max(longestStreak, tempStreak);
        } else {
            tempStreak = 0;
        }
    });

    // Category averages
    const avgPhysical = Math.round(scoresArray.reduce((a, b) => a + b.score_physical, 0) / scoresArray.length);
    const avgMental = Math.round(scoresArray.reduce((a, b) => a + b.score_mental, 0) / scoresArray.length);
    const avgSpiritual = Math.round(scoresArray.reduce((a, b) => a + b.score_spiritual, 0) / scoresArray.length);

    // Time of day averages
    const avgMorning = Math.round(scoresArray.reduce((a, b) => a + b.score_morning, 0) / scoresArray.length);
    const avgAfternoon = Math.round(scoresArray.reduce((a, b) => a + b.score_afternoon, 0) / scoresArray.length);
    const avgEvening = Math.round(scoresArray.reduce((a, b) => a + b.score_evening, 0) / scoresArray.length);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Statistics & Streaks</h2>
            
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4">
                    <div className="text-xs text-amber-300 mb-1">Average Score</div>
                    <div className="text-3xl font-bold text-amber-400">{avgScore}</div>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-4">
                    <div className="text-xs text-blue-300 mb-1">Highest Score</div>
                    <div className="text-3xl font-bold text-blue-400">{maxScore}</div>
                </div>
                <div className="rounded-lg border border-green-500/30 bg-green-950/30 p-4">
                    <div className="text-xs text-green-300 mb-1">Current Streak</div>
                    <div className="text-3xl font-bold text-green-400">{currentStreak} days</div>
                </div>
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/30 p-4">
                    <div className="text-xs text-purple-300 mb-1">Longest Streak</div>
                    <div className="text-3xl font-bold text-purple-400">{longestStreak} days</div>
                </div>
            </div>

            {/* Category Averages */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Category Averages</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-xs text-blue-300 mb-1">Physical</div>
                        <div className="text-2xl font-bold text-blue-400">{avgPhysical}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-purple-300 mb-1">Mental</div>
                        <div className="text-2xl font-bold text-purple-400">{avgMental}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-amber-300 mb-1">Spiritual</div>
                        <div className="text-2xl font-bold text-amber-400">{avgSpiritual}</div>
                    </div>
                </div>
            </div>

            {/* Time of Day Averages */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Time of Day Averages</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-xs text-slate-300 mb-1">Morning</div>
                        <div className="text-2xl font-bold text-slate-200">{avgMorning}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-300 mb-1">Afternoon</div>
                        <div className="text-2xl font-bold text-slate-200">{avgAfternoon}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-300 mb-1">Evening</div>
                        <div className="text-2xl font-bold text-slate-200">{avgEvening}</div>
                    </div>
                </div>
                {avgMorning > avgEvening + 10 && (
                    <div className="mt-3 text-xs text-amber-400 text-center">
                        💡 Your morning scores are consistently higher than evenings. Consider adjusting your evening routine.
                    </div>
                )}
            </div>

            {/* Recent Scores */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold mb-3">Recent Scores</h3>
                <div className="space-y-2">
                    {sortedDates.slice(0, 7).map(dateStr => {
                        const score = dailyScores.get(dateStr);
                        if (!score) return null;
                        const date = new Date(dateStr);
                        return (
                            <div key={dateStr} className="flex items-center justify-between p-2 rounded bg-slate-900">
                                <div className="text-sm">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{score.score_overall}</span>
                                    <span className="text-xs text-slate-400">{score.grade}</span>
                                    <span className="text-xs">{getVisualScore(score.score_overall)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function GoalsView() {
    const [goals, setGoals] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState<any | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    
    const [goalForm, setGoalForm] = useState({
        name: '',
        description: '',
        category: null as string | null,
        priority_score: 0,
        deadline: '' as string | null,
        target_value: '',
        target_unit: '',
        current_value: '',
        parent_goal_id: null as string | null,
        is_completed: false,
    });
    
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    
    const [goalMilestones, setGoalMilestones] = useState<Array<{
        id?: string;
        name: string;
        values: string;
        is_completed?: boolean;
    }>>([]);
    
    const [goalSubGoals, setGoalSubGoals] = useState<Array<{
        id?: string;
        name: string;
        description: string;
        category: string | null;
        target_value: string;
        target_unit: string;
    }>>([]);
    
    const [goalHabits, setGoalHabits] = useState<Array<{
        id?: string;
        name: string;
        icon: string;
        category: Category;
        time_of_day: TimeOfDay | null;
        is_bad_habit: boolean;
        auto_streak_milestones: boolean; // Enable automatic streak milestones
    }>>([]);

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: goalsData } = await supabase
                .from('habit_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_archived', showArchived)
                .order('created_at', { ascending: false });

            const { data: milestonesData } = await supabase
                .from('habit_milestones')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_archived', showArchived)
                .order('created_at', { ascending: false });

            setGoals(goalsData || []);
            setMilestones(milestonesData || []);
        } catch (error) {
            console.error('Error loading goals:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadHabitTemplates = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            setHabitTemplates(data || []);
        } catch (error) {
            console.error('Error loading habit templates:', error);
        }
    };

    const handleSaveGoal = async () => {
        if (!goalForm.name.trim()) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let goalData;
            
            if (editingGoal) {
                // Update existing goal
                const { data } = await supabase
                    .from('habit_goals')
                    .update({
                        name: goalForm.name,
                        description: goalForm.description || null,
                        category: goalForm.category || null,
                        priority_score: goalForm.priority_score || 0,
                        deadline: goalForm.deadline || null,
                        target_value: goalForm.target_value ? parseFloat(goalForm.target_value) : null,
                        target_unit: goalForm.target_unit || null,
                        current_value: goalForm.current_value ? parseFloat(goalForm.current_value) : null,
                        parent_goal_id: goalForm.parent_goal_id || null,
                        is_completed: goalForm.is_completed || false,
                    })
                    .eq('id', editingGoal.id)
                    .eq('user_id', user.id)
                    .select()
                    .single();
                goalData = data;
            } else {
                // Create new goal
                const { data } = await supabase
                    .from('habit_goals')
                    .insert({
                        user_id: user.id,
                        name: goalForm.name,
                        description: goalForm.description || null,
                        category: goalForm.category || null,
                        priority_score: goalForm.priority_score || 0,
                        deadline: goalForm.deadline || null,
                        target_value: goalForm.target_value ? parseFloat(goalForm.target_value) : null,
                        target_unit: goalForm.target_unit || null,
                        current_value: goalForm.current_value ? parseFloat(goalForm.current_value) : null,
                        parent_goal_id: goalForm.parent_goal_id || null,
                        is_completed: goalForm.is_completed || false,
                    })
                    .select()
                    .single();
                goalData = data;
            }

            if (!goalData) return;

            // Save sub-goals
            for (const subGoal of goalSubGoals) {
                if (!subGoal.name.trim()) continue;
                
                if (subGoal.id) {
                    // Update existing sub-goal
                    await supabase
                        .from('habit_goals')
                        .update({
                            name: subGoal.name,
                            description: subGoal.description || null,
                            category: subGoal.category || null,
                            target_value: subGoal.target_value ? parseFloat(subGoal.target_value) : null,
                            target_unit: subGoal.target_unit || null,
                            parent_goal_id: goalData.id,
                        })
                        .eq('id', subGoal.id);
                } else {
                    // Create new sub-goal
                    await supabase
                        .from('habit_goals')
                        .insert({
                            user_id: user.id,
                            name: subGoal.name,
                            description: subGoal.description || null,
                            category: subGoal.category || null,
                            target_value: subGoal.target_value ? parseFloat(subGoal.target_value) : null,
                            target_unit: subGoal.target_unit || null,
                            parent_goal_id: goalData.id,
                        });
                }
            }

            // Save habits
            for (const habit of goalHabits) {
                if (!habit.name.trim()) continue;
                
                if (habit.id) {
                    // Update existing habit
                    await supabase
                        .from('habit_templates')
                        .update({
                            name: habit.name,
                            icon: habit.icon,
                            category: habit.category,
                            time_of_day: habit.time_of_day,
                            is_bad_habit: habit.is_bad_habit,
                            goal_id: goalData.id,
                        })
                        .eq('id', habit.id);
                } else {
                    // Create new habit
                    const { data: habitData } = await supabase
                        .from('habit_templates')
                        .insert({
                            user_id: user.id,
                            name: habit.name,
                            icon: habit.icon,
                            category: habit.category,
                            time_of_day: habit.time_of_day,
                            is_bad_habit: habit.is_bad_habit,
                            goal_id: goalData.id,
                        })
                        .select()
                        .single();

                    // Create automatic streak milestones if enabled
                    if (habit.auto_streak_milestones && habitData) {
                        const streakValues = [3, 7, 14, 30, 60, 90, 180, 365]; // Common streak milestones
                        await supabase
                            .from('habit_milestones')
                            .insert({
                                user_id: user.id,
                                name: `${habit.name} - Streak`,
                                values: streakValues,
                                goal_id: goalData.id,
                            });
                    }
                }
            }

            // Save milestones
            const existingMilestones = milestones.filter(m => m.goal_id === goalData.id);
            const milestoneIdsToKeep = goalMilestones.filter(m => m.id).map(m => m.id);
            
            // Delete removed milestones
            for (const existing of existingMilestones) {
                if (!milestoneIdsToKeep.includes(existing.id)) {
                    await supabase
                        .from('habit_milestones')
                        .delete()
                        .eq('id', existing.id);
                }
            }

            // Add/update milestones
            for (const milestone of goalMilestones) {
                if (!milestone.name.trim() || !milestone.values.trim()) continue;
                
                const values = milestone.values
                    .split(',')
                    .map(v => parseFloat(v.trim()))
                    .filter(v => !isNaN(v))
                    .sort((a, b) => a - b);

                if (values.length === 0) continue;

                if (milestone.id) {
                    await supabase
                        .from('habit_milestones')
                        .update({
                            name: milestone.name,
                            values: values,
                            is_completed: milestone.is_completed || false,
                        })
                        .eq('id', milestone.id);
                } else {
                    await supabase
                        .from('habit_milestones')
                        .insert({
                            user_id: user.id,
                            name: milestone.name,
                            values: values,
                            goal_id: goalData.id,
                            is_completed: milestone.is_completed || false,
                        });
                }
            }

            // Reset form
            setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', parent_goal_id: null, is_completed: false });
            setGoalMilestones([]);
            setGoalSubGoals([]);
            setGoalHabits([]);
            setEditingGoal(null);
            setShowGoalForm(false);
            loadGoals();
            loadHabitTemplates();
        } catch (error) {
            console.error('Error saving goal:', error);
        }
    };

    const handleEditGoal = (goal: any) => {
        setEditingGoal(goal);
        setGoalForm({
            name: goal.name,
            description: goal.description || '',
            category: goal.category || null,
            priority_score: goal.priority_score || 0,
            deadline: goal.deadline || '',
            target_value: goal.target_value?.toString() || '',
            target_unit: goal.target_unit || '',
            current_value: goal.current_value?.toString() || '',
            parent_goal_id: goal.parent_goal_id || null,
            is_completed: goal.is_completed || false,
        });
        
        // Load milestones
        const goalMilestonesData = milestones
            .filter(m => m.goal_id === goal.id)
            .map(m => ({
                id: m.id,
                name: m.name,
                values: Array.isArray(m.values) ? m.values.join(', ') : m.values,
                is_completed: m.is_completed || false,
            }));
        setGoalMilestones(goalMilestonesData);
        
        // Load sub-goals
        const subGoalsData = goals
            .filter(g => g.parent_goal_id === goal.id)
            .map(g => ({
                id: g.id,
                name: g.name,
                description: g.description || '',
                category: g.category || null,
                target_value: g.target_value?.toString() || '',
                target_unit: g.target_unit || '',
            }));
        setGoalSubGoals(subGoalsData);
        
        // Load habits
        const habitsData = habitTemplates
            .filter(h => h.goal_id === goal.id)
            .map(h => ({
                id: h.id,
                name: h.name,
                icon: h.icon || '📝',
                category: h.category,
                time_of_day: h.time_of_day,
                is_bad_habit: h.is_bad_habit || false,
                auto_streak_milestones: false, // Check if streak milestone exists
            }));
        setGoalHabits(habitsData);
        
        setShowGoalForm(true);
    };

    const handleArchiveGoal = async (goalId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_goals')
                .update({ is_archived: true })
                .eq('id', goalId)
                .eq('user_id', user.id);

            // Archive all milestones for this goal
            await supabase
                .from('habit_milestones')
                .update({ is_archived: true })
                .eq('goal_id', goalId)
                .eq('user_id', user.id);

            loadGoals();
        } catch (error) {
            console.error('Error archiving goal:', error);
        }
    };

    const handleArchiveMilestone = async (milestoneId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_milestones')
                .update({ is_archived: true })
                .eq('id', milestoneId)
                .eq('user_id', user.id);

            loadGoals();
        } catch (error) {
            console.error('Error archiving milestone:', error);
        }
    };

    const handleUnarchiveGoal = async (goalId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_goals')
                .update({ is_archived: false })
                .eq('id', goalId)
                .eq('user_id', user.id);

            loadGoals();
        } catch (error) {
            console.error('Error unarchiving goal:', error);
        }
    };

    const addMilestoneToForm = () => {
        setGoalMilestones([...goalMilestones, { name: '', values: '' }]);
    };

    const removeMilestoneFromForm = (index: number) => {
        setGoalMilestones(goalMilestones.filter((_, i) => i !== index));
    };

    const updateMilestoneInForm = (index: number, field: string, value: any) => {
        const updated = [...goalMilestones];
        updated[index] = { ...updated[index], [field]: value };
        setGoalMilestones(updated);
    };

    const addSubGoalToForm = () => {
        setGoalSubGoals([...goalSubGoals, { name: '', description: '', category: null, target_value: '', target_unit: '' }]);
    };

    const removeSubGoalFromForm = (index: number) => {
        setGoalSubGoals(goalSubGoals.filter((_, i) => i !== index));
    };

    const updateSubGoalInForm = (index: number, field: string, value: any) => {
        const updated = [...goalSubGoals];
        updated[index] = { ...updated[index], [field]: value };
        setGoalSubGoals(updated);
    };

    const addHabitToForm = () => {
        setGoalHabits([...goalHabits, { name: '', icon: '📝', category: 'mental', time_of_day: null, is_bad_habit: false, auto_streak_milestones: true }]);
    };

    const removeHabitFromForm = (index: number) => {
        setGoalHabits(goalHabits.filter((_, i) => i !== index));
    };

    const updateHabitInForm = (index: number, field: string, value: any) => {
        const updated = [...goalHabits];
        updated[index] = { ...updated[index], [field]: value };
        setGoalHabits(updated);
    };

    const goalCategories = ['financial', 'physical', 'spiritual', 'business', 'personal', 'mental', 'health', 'career', 'relationships', 'education', 'other'] as const;
    
    const filteredGoals = categoryFilter === 'all' 
        ? goals 
        : categoryFilter === 'uncategorized'
        ? goals.filter(g => !g.category)
        : goals.filter(g => g.category === categoryFilter);
    
    const mainGoals = filteredGoals.filter(g => !g.parent_goal_id);
    const subGoals = filteredGoals.filter(g => g.parent_goal_id);
    
    // Group goals by category for "all" view
    const goalsByCategory = goalCategories.reduce((acc, cat) => {
        acc[cat] = goals.filter(g => !g.parent_goal_id && g.category === cat);
        return acc;
    }, {} as Record<string, typeof goals>);
    
    const uncategorizedGoals = goals.filter(g => !g.parent_goal_id && !g.category);

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Goals & Milestones</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setShowArchived(!showArchived);
                            setEditingGoal(null);
                            setShowGoalForm(false);
                            setGoalMilestones([]);
                        }}
                        className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                            showArchived 
                                ? 'border-amber-400 bg-amber-400/10 text-amber-400' 
                                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        {showArchived ? 'Show Active' : 'Show Archived'}
                    </button>
                    <button
                        onClick={() => {
                            setShowGoalForm(!showGoalForm);
                            setEditingGoal(null);
                            setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', parent_goal_id: null, is_completed: false });
                            setGoalMilestones([]);
                            setGoalSubGoals([]);
                            setGoalHabits([]);
                        }}
                        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                    >
                        + Add Goal
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            {!showArchived && (
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-400">Filter by category:</span>
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-sm"
                    >
                        <option value="all">All Categories</option>
                        {goalCategories.map(cat => (
                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                        <option value="uncategorized">Uncategorized</option>
                    </select>
                </div>
            )}

            {/* Unified Goal Form (Add/Edit) */}
            {showGoalForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <h3 className="text-lg font-semibold">{editingGoal ? 'Edit Goal' : 'New Goal'}</h3>
                    
                    {/* Goal Basic Info */}
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Goal name (e.g., Lose 50lbs)"
                            value={goalForm.name}
                            onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        />
                        <textarea
                            placeholder="Description (optional)"
                            value={goalForm.description}
                            onChange={e => setGoalForm({ ...goalForm, description: e.target.value })}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm min-h-[60px]"
                        />
                        <select
                            value={goalForm.category || ''}
                            onChange={e => setGoalForm({ ...goalForm, category: e.target.value || null })}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        >
                            <option value="">No category</option>
                            {goalCategories.map(cat => (
                                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Priority score"
                                value={goalForm.priority_score}
                                onChange={e => setGoalForm({ ...goalForm, priority_score: parseInt(e.target.value) || 0 })}
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            />
                            <input
                                type="date"
                                placeholder="Deadline"
                                value={goalForm.deadline || ''}
                                onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value || null })}
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Current value"
                                value={goalForm.current_value}
                                onChange={e => setGoalForm({ ...goalForm, current_value: e.target.value })}
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            />
                            <input
                                type="number"
                                placeholder="Target value"
                                value={goalForm.target_value}
                                onChange={e => setGoalForm({ ...goalForm, target_value: e.target.value })}
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Unit (e.g., lbs, views)"
                                value={goalForm.target_unit}
                                onChange={e => setGoalForm({ ...goalForm, target_unit: e.target.value })}
                                className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            />
                        </div>
                        {!editingGoal && (
                            <select
                                value={goalForm.parent_goal_id || ''}
                                onChange={e => setGoalForm({ ...goalForm, parent_goal_id: e.target.value || null })}
                                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                            >
                                <option value="">No parent goal (main goal)</option>
                                {mainGoals.map(goal => (
                                    <option key={goal.id} value={goal.id}>{goal.name}</option>
                                ))}
                            </select>
                        )}
                        {editingGoal && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={goalForm.is_completed}
                                    onChange={e => setGoalForm({ ...goalForm, is_completed: e.target.checked })}
                                    className="rounded border-slate-700"
                                />
                                <label className="text-sm text-slate-300">Mark as completed</label>
                            </div>
                        )}
                    </div>

                    {/* Sub-Goals Section */}
                    <div className="border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Sub-Goals</h4>
                            <button
                                type="button"
                                onClick={addSubGoalToForm}
                                className="text-xs text-amber-400 hover:text-amber-300"
                            >
                                + Add Sub-Goal
                            </button>
                        </div>
                        {goalSubGoals.map((subGoal, index) => (
                            <div key={index} className="mb-3 p-3 rounded border border-slate-800 bg-slate-900 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Sub-goal name"
                                        value={subGoal.name}
                                        onChange={e => updateSubGoalInForm(index, 'name', e.target.value)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeSubGoalFromForm(index)}
                                        className="text-xs text-red-400 hover:text-red-300 px-2"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <textarea
                                    placeholder="Description (optional)"
                                    value={subGoal.description}
                                    onChange={e => updateSubGoalInForm(index, 'description', e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={subGoal.category || ''}
                                        onChange={e => updateSubGoalInForm(index, 'category', e.target.value || null)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    >
                                        <option value="">No category</option>
                                        {goalCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="Target value"
                                        value={subGoal.target_value}
                                        onChange={e => updateSubGoalInForm(index, 'target_value', e.target.value)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Unit"
                                        value={subGoal.target_unit}
                                        onChange={e => updateSubGoalInForm(index, 'target_unit', e.target.value)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Habits Section */}
                    <div className="border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Habits</h4>
                            <button
                                type="button"
                                onClick={addHabitToForm}
                                className="text-xs text-amber-400 hover:text-amber-300"
                            >
                                + Add Habit
                            </button>
                        </div>
                        {goalHabits.map((habit, index) => (
                            <div key={index} className="mb-3 p-3 rounded border border-slate-800 bg-slate-900 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Icon (emoji)"
                                        value={habit.icon}
                                        onChange={e => updateHabitInForm(index, 'icon', e.target.value)}
                                        className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Habit name (e.g., Morning Workout)"
                                        value={habit.name}
                                        onChange={e => updateHabitInForm(index, 'name', e.target.value)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeHabitFromForm(index)}
                                        className="text-xs text-red-400 hover:text-red-300 px-2"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={habit.category}
                                        onChange={e => updateHabitInForm(index, 'category', e.target.value as Category)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    >
                                        <option value="physical">Physical</option>
                                        <option value="mental">Mental</option>
                                        <option value="spiritual">Spiritual</option>
                                    </select>
                                    <select
                                        value={habit.time_of_day || ''}
                                        onChange={e => updateHabitInForm(index, 'time_of_day', e.target.value || null)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    >
                                        <option value="">Any time</option>
                                        <option value="morning">Morning</option>
                                        <option value="afternoon">Afternoon</option>
                                        <option value="evening">Evening</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={habit.is_bad_habit}
                                            onChange={e => updateHabitInForm(index, 'is_bad_habit', e.target.checked)}
                                            className="rounded border-slate-700"
                                        />
                                        Bad habit (to avoid)
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={habit.auto_streak_milestones}
                                            onChange={e => updateHabitInForm(index, 'auto_streak_milestones', e.target.checked)}
                                            className="rounded border-slate-700"
                                        />
                                        Auto streak milestones (3, 7, 14, 30, 60, 90, 180, 365 days)
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Milestones Section */}
                    <div className="border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Milestones</h4>
                            <button
                                type="button"
                                onClick={addMilestoneToForm}
                                className="text-xs text-amber-400 hover:text-amber-300"
                            >
                                + Add Milestone
                            </button>
                        </div>
                        {goalMilestones.map((milestone, index) => (
                            <div key={index} className="mb-3 p-3 rounded border border-slate-800 bg-slate-900 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Milestone name (e.g., Youtube views)"
                                        value={milestone.name}
                                        onChange={e => updateMilestoneInForm(index, 'name', e.target.value)}
                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeMilestoneFromForm(index)}
                                        className="text-xs text-red-400 hover:text-red-300 px-2"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Values (comma-separated, e.g., 5, 10, 25, 100, 500, 1000)"
                                    value={milestone.values}
                                    onChange={e => updateMilestoneInForm(index, 'values', e.target.value)}
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                />
                                {editingGoal && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={milestone.is_completed || false}
                                            onChange={e => updateMilestoneInForm(index, 'is_completed', e.target.checked)}
                                            className="rounded border-slate-700"
                                        />
                                        <label className="text-xs text-slate-400">Mark as completed</label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t border-slate-800">
                        <button
                            onClick={handleSaveGoal}
                            className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                        >
                            {editingGoal ? 'Update Goal' : 'Save Goal'}
                        </button>
                        <button
                            onClick={() => {
                                setShowGoalForm(false);
                                setEditingGoal(null);
                                setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', parent_goal_id: null, is_completed: false });
                                setGoalMilestones([]);
                                setGoalSubGoals([]);
                                setGoalHabits([]);
                            }}
                            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Goals List */}
            <div className="space-y-6">
                {categoryFilter === 'all' ? (
                    <>
                        {goalCategories.map(category => {
                            const categoryGoals = goalsByCategory[category];
                            if (categoryGoals.length === 0) return null;
                            
                            return (
                                <div key={category}>
                                    <h3 className="text-lg font-semibold mb-3 capitalize text-slate-300">
                                        {category.charAt(0).toUpperCase() + category.slice(1)} Goals
                                    </h3>
                                    <div className="space-y-4">
                                        {categoryGoals.map(goal => {
                                            const goalSubGoals = subGoals.filter(sg => sg.parent_goal_id === goal.id);
                                            const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                                            const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                                            return (
                                                <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-lg font-semibold">{goal.name}</h3>
                                                                {goal.category && (
                                                                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded capitalize">
                                                                        {goal.category}
                                                                    </span>
                                                                )}
                                                                {goal.is_completed && (
                                                                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Completed</span>
                                                                )}
                                                            </div>
                                                            {goal.description && (
                                                                <p className="text-sm text-slate-400 mt-1">{goal.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleEditGoal(goal)}
                                                                className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                                            >
                                                                Edit
                                                            </button>
                                                            {!showArchived ? (
                                                                <button
                                                                    onClick={() => handleArchiveGoal(goal.id)}
                                                                    className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
                                                                >
                                                                    Archive
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUnarchiveGoal(goal.id)}
                                                                    className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                                                >
                                                                    Unarchive
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {goal.target_value && (
                                                        <div className="mt-3">
                                                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                                <span>Progress</span>
                                                                <span>{goal.current_value} / {goal.target_value} {goal.target_unit}</span>
                                                            </div>
                                                            <div className="w-full bg-slate-800 rounded-full h-2">
                                                                <div
                                                                    className="bg-amber-400 h-2 rounded-full transition-all"
                                                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {goalSubGoals.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            <div className="text-xs text-slate-400 mb-1">Sub-goals:</div>
                                                            {goalSubGoals.map(subGoal => (
                                                                <div key={subGoal.id} className="text-sm text-slate-300 pl-4 border-l-2 border-slate-700">
                                                                    • {subGoal.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {goalMilestones.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            <div className="text-xs text-slate-400 mb-1">Milestones:</div>
                                                            {goalMilestones.map(milestone => (
                                                                <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                                                    <div className="flex items-center gap-2">
                                                                        {milestone.is_completed && (
                                                                            <span className="text-xs text-green-400">✓</span>
                                                                        )}
                                                                        <span className="font-medium">{milestone.name}:</span>
                                                                        {Array.isArray(milestone.values) && milestone.values.map((v: number, i: number) => (
                                                                            <span key={i} className={`text-xs px-2 py-0.5 rounded mr-1 ${
                                                                                milestone.is_completed ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'
                                                                            }`}>
                                                                                {v}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    {!showArchived && (
                                                                        <button
                                                                            onClick={() => handleArchiveMilestone(milestone.id)}
                                                                            className="text-xs text-slate-400 hover:text-slate-300"
                                                                        >
                                                                            Archive
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {uncategorizedGoals.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-3 text-slate-300">Uncategorized Goals</h3>
                                <div className="space-y-4">
                                    {uncategorizedGoals.map(goal => {
                                        const goalSubGoals = subGoals.filter(sg => sg.parent_goal_id === goal.id);
                                        const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                                        const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                                        return (
                                            <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-lg font-semibold">{goal.name}</h3>
                                                            {goal.is_completed && (
                                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Completed</span>
                                                            )}
                                                        </div>
                                                        {goal.description && (
                                                            <p className="text-sm text-slate-400 mt-1">{goal.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditGoal(goal)}
                                                            className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                                        >
                                                            Edit
                                                        </button>
                                                        {!showArchived ? (
                                                            <button
                                                                onClick={() => handleArchiveGoal(goal.id)}
                                                                className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
                                                            >
                                                                Archive
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleUnarchiveGoal(goal.id)}
                                                                className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                                            >
                                                                Unarchive
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {goal.target_value && (
                                                    <div className="mt-3">
                                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                            <span>Progress</span>
                                                            <span>{goal.current_value} / {goal.target_value} {goal.target_unit}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-800 rounded-full h-2">
                                                            <div
                                                                className="bg-amber-400 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {goalSubGoals.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-xs text-slate-400 mb-1">Sub-goals:</div>
                                                        {goalSubGoals.map(subGoal => (
                                                            <div key={subGoal.id} className="text-sm text-slate-300 pl-4 border-l-2 border-slate-700">
                                                                • {subGoal.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {goalMilestones.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="text-xs text-slate-400 mb-1">Milestones:</div>
                                                        {goalMilestones.map(milestone => (
                                                            <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                                                <div className="flex items-center gap-2">
                                                                    {milestone.is_completed && (
                                                                        <span className="text-xs text-green-400">✓</span>
                                                                    )}
                                                                    <span className="font-medium">{milestone.name}:</span>
                                                                    {Array.isArray(milestone.values) && milestone.values.map((v: number, i: number) => (
                                                                        <span key={i} className={`text-xs px-2 py-0.5 rounded mr-1 ${
                                                                            milestone.is_completed ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'
                                                                        }`}>
                                                                            {v}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                {!showArchived && (
                                                                    <button
                                                                        onClick={() => handleArchiveMilestone(milestone.id)}
                                                                        className="text-xs text-slate-400 hover:text-slate-300"
                                                                    >
                                                                        Archive
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-4">
                        {mainGoals.map(goal => {
                    const goalSubGoals = subGoals.filter(sg => sg.parent_goal_id === goal.id);
                    const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                    const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                    return (
                        <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold">{goal.name}</h3>
                                        {goal.category && (
                                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded capitalize">
                                                {goal.category}
                                            </span>
                                        )}
                                        {goal.is_completed && (
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Completed</span>
                                        )}
                                    </div>
                                    {goal.description && (
                                        <p className="text-sm text-slate-400 mt-1">{goal.description}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditGoal(goal)}
                                        className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                    >
                                        Edit
                                    </button>
                                    {!showArchived ? (
                                        <button
                                            onClick={() => handleArchiveGoal(goal.id)}
                                            className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
                                        >
                                            Archive
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleUnarchiveGoal(goal.id)}
                                            className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1"
                                        >
                                            Unarchive
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {goal.target_value && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                        <span>Progress</span>
                                        <span>{goal.current_value} / {goal.target_value} {goal.target_unit}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2">
                                        <div
                                            className="bg-amber-400 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {goalSubGoals.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-xs text-slate-400 mb-1">Sub-goals:</div>
                                    {goalSubGoals.map(subGoal => (
                                        <div key={subGoal.id} className="text-sm text-slate-300 pl-4 border-l-2 border-slate-700">
                                            • {subGoal.name}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {goalMilestones.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-xs text-slate-400 mb-1">Milestones:</div>
                                    {goalMilestones.map(milestone => (
                                        <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                            <div className="flex items-center gap-2">
                                                {milestone.is_completed && (
                                                    <span className="text-xs text-green-400">✓</span>
                                                )}
                                                <span className="font-medium">{milestone.name}:</span>
                                                {Array.isArray(milestone.values) && milestone.values.map((v: number, i: number) => (
                                                    <span key={i} className={`text-xs px-2 py-0.5 rounded mr-1 ${
                                                        milestone.is_completed ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'
                                                    }`}>
                                                        {v}
                                                    </span>
                                                ))}
                                            </div>
                                            {!showArchived && (
                                                <button
                                                    onClick={() => handleArchiveMilestone(milestone.id)}
                                                    className="text-xs text-slate-400 hover:text-slate-300"
                                                >
                                                    Archive
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                        {mainGoals.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                {categoryFilter === 'all' 
                                    ? 'No goals yet. Create your first goal to get started!'
                                    : categoryFilter === 'uncategorized'
                                    ? 'No uncategorized goals.'
                                    : `No goals in this category. Create a goal with the "${categoryFilter}" category!`}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

// Habits Management View Component
function HabitsManagementView({
    habitTemplates,
    onDataChange,
}: {
    habitTemplates: HabitTemplate[];
    onDataChange: () => void;
}) {
    const [showForm, setShowForm] = useState(false);
    const [editingHabit, setEditingHabit] = useState<HabitTemplate | null>(null);
    const [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
    const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
    
    const [formData, setFormData] = useState({
        name: '',
        icon: '📝',
        category: 'mental' as Category,
        time_of_day: null as TimeOfDay | null,
        is_bad_habit: false,
        goal_id: null as string | null,
    });

    const [goals, setGoals] = useState<any[]>([]);

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: goalsData } = await supabase
                .from('habit_goals')
                .select('*')
                .eq('user_id', user.id)
                .order('name');

            setGoals(goalsData || []);
        } catch (error) {
            console.error('Error loading goals:', error);
        }
    };

    const handleEdit = (habit: HabitTemplate) => {
        setEditingHabit(habit);
        setFormData({
            name: habit.name,
            icon: habit.icon,
            category: habit.category,
            time_of_day: habit.time_of_day,
            is_bad_habit: habit.is_bad_habit,
            goal_id: habit.goal_id,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this habit? This will also delete all daily entries for this habit.')) {
            return;
        }

        try {
            await supabase
                .from('habit_templates')
                .delete()
                .eq('id', id);
            
            onDataChange();
        } catch (error) {
            console.error('Error deleting habit:', error);
        }
    };

    const handleToggleActive = async (habit: HabitTemplate) => {
        try {
            await supabase
                .from('habit_templates')
                .update({ is_active: !habit.is_active })
                .eq('id', habit.id);
            
            onDataChange();
        } catch (error) {
            console.error('Error toggling habit:', error);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (editingHabit) {
                await supabase
                    .from('habit_templates')
                    .update({
                        name: formData.name,
                        icon: formData.icon,
                        category: formData.category,
                        time_of_day: formData.time_of_day,
                        is_bad_habit: formData.is_bad_habit,
                        goal_id: formData.goal_id,
                    })
                    .eq('id', editingHabit.id);
            } else {
                await supabase
                    .from('habit_templates')
                    .insert({
                        user_id: user.id,
                        name: formData.name,
                        icon: formData.icon,
                        category: formData.category,
                        time_of_day: formData.time_of_day,
                        is_bad_habit: formData.is_bad_habit,
                        goal_id: formData.goal_id,
                        is_active: true,
                    });
            }

            setShowForm(false);
            setEditingHabit(null);
            setFormData({
                name: '',
                icon: '📝',
                category: 'mental',
                time_of_day: null,
                is_bad_habit: false,
                goal_id: null,
            });
            onDataChange();
        } catch (error) {
            console.error('Error saving habit:', error);
        }
    };

    const filteredHabits = habitTemplates.filter(habit => {
        if (filter === 'good' && habit.is_bad_habit) return false;
        if (filter === 'bad' && !habit.is_bad_habit) return false;
        if (categoryFilter !== 'all' && habit.category !== categoryFilter) return false;
        return true;
    });

    const habitsByCategory = {
        physical: filteredHabits.filter(h => h.category === 'physical'),
        mental: filteredHabits.filter(h => h.category === 'mental'),
        spiritual: filteredHabits.filter(h => h.category === 'spiritual'),
    };

    const categoryColors = {
        physical: 'border-blue-500/30 bg-blue-950/30',
        mental: 'border-purple-500/30 bg-purple-950/30',
        spiritual: 'border-amber-500/30 bg-amber-950/30',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Habits & Bad Habits</h2>
                <button
                    onClick={() => {
                        setEditingHabit(null);
                        setFormData({
                            name: '',
                            icon: '📝',
                            category: 'mental',
                            time_of_day: null,
                            is_bad_habit: false,
                            goal_id: null,
                        });
                        setShowForm(!showForm);
                    }}
                    className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                >
                    {showForm ? 'Cancel' : '+ Add Habit'}
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 items-center">
                <div className="flex gap-1 rounded-md border border-slate-700 bg-slate-900 p-1">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1 text-xs rounded ${
                            filter === 'all' ? 'bg-amber-400 text-black' : 'text-slate-300'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('good')}
                        className={`px-3 py-1 text-xs rounded ${
                            filter === 'good' ? 'bg-amber-400 text-black' : 'text-slate-300'
                        }`}
                    >
                        Good Habits
                    </button>
                    <button
                        onClick={() => setFilter('bad')}
                        className={`px-3 py-1 text-xs rounded ${
                            filter === 'bad' ? 'bg-amber-400 text-black' : 'text-slate-300'
                        }`}
                    >
                        Bad Habits
                    </button>
                </div>
                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value as Category | 'all')}
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-sm"
                >
                    <option value="all">All Categories</option>
                    <option value="physical">Physical</option>
                    <option value="mental">Mental</option>
                    <option value="spiritual">Spiritual</option>
                </select>
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <h3 className="text-sm font-semibold">{editingHabit ? 'Edit Habit' : 'New Habit'}</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Icon (emoji)"
                            value={formData.icon}
                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                            maxLength={2}
                        />
                        <input
                            type="text"
                            placeholder="Habit name..."
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        >
                            <option value="physical">Physical</option>
                            <option value="mental">Mental</option>
                            <option value="spiritual">Spiritual</option>
                        </select>
                        <select
                            value={formData.time_of_day || ''}
                            onChange={e => setFormData({ ...formData, time_of_day: (e.target.value as TimeOfDay) || null })}
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        >
                            <option value="">Any Time</option>
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="evening">Evening</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_bad_habit"
                            checked={formData.is_bad_habit}
                            onChange={e => setFormData({ ...formData, is_bad_habit: e.target.checked })}
                            className="rounded border-slate-700"
                        />
                        <label htmlFor="is_bad_habit" className="text-sm text-slate-300">
                            This is a bad habit (to avoid)
                        </label>
                    </div>
                    <select
                        value={formData.goal_id || ''}
                        onChange={e => setFormData({ ...formData, goal_id: e.target.value || null })}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                    >
                        <option value="">No associated goal</option>
                        {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSubmit}
                            className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                        >
                            {editingHabit ? 'Update' : 'Add'} Habit
                        </button>
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setEditingHabit(null);
                            }}
                            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Habits List */}
            <div className="space-y-4">
                {(['physical', 'mental', 'spiritual'] as Category[]).map(category => {
                    const categoryHabits = habitsByCategory[category];
                    if (categoryHabits.length === 0) return null;

                    return (
                        <div key={category} className={`rounded-lg border ${categoryColors[category]} p-4`}>
                            <h3 className="text-sm font-semibold mb-3 capitalize">{category} Habits</h3>
                            <div className="space-y-2">
                                {categoryHabits.map(habit => (
                                    <div
                                        key={habit.id}
                                        className="flex items-center justify-between p-2 rounded bg-slate-900/50 hover:bg-slate-900 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-lg">{habit.icon}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-200">{habit.name}</span>
                                                    {habit.is_bad_habit && (
                                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                                                            Bad Habit
                                                        </span>
                                                    )}
                                                    {!habit.is_active && (
                                                        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {habit.time_of_day && (
                                                        <span className="text-xs text-slate-400 capitalize">
                                                            {habit.time_of_day}
                                                        </span>
                                                    )}
                                                    {habit.goal_id && (
                                                        <span className="text-xs text-amber-400">
                                                            Goal: {goals.find(g => g.id === habit.goal_id)?.name || 'Unknown'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleActive(habit)}
                                                className={`text-xs px-2 py-1 rounded ${
                                                    habit.is_active
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}
                                            >
                                                {habit.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(habit)}
                                                className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(habit.id)}
                                                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredHabits.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        No habits found. Create your first habit to get started!
                    </div>
                )}
            </div>
        </div>
    );
}
