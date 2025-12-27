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
    prioritiesCount?: number;
    todosCount?: number;
    habitsCount?: number;
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
    const [scoringSettings, setScoringSettings] = useState({
        habits_weight: 40,
        priorities_weight: 35,
        todos_weight: 25,
    });
    const [monthPriorities, setMonthPriorities] = useState<any[]>([]);
    const [monthTodos, setMonthTodos] = useState<any[]>([]);

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

            // Load priorities for the entire month (for calendar)
            const { data: monthPrioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('date')
                .eq('user_id', user.id)
                .gte('date', monthStartStr)
                .lte('date', monthEndStr);

            // Load todos for the entire month (for calendar)
            const { data: monthTodosData } = await supabase
                .from('habit_daily_todos')
                .select('date')
                .eq('user_id', user.id)
                .gte('date', monthStartStr)
                .lte('date', monthEndStr);

            setMonthPriorities(monthPrioritiesData || []);
            setMonthTodos(monthTodosData || []);

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

            // Load scoring settings
            const { data: scoringData, error: scoringError } = await supabase
                .from('habit_scoring_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (scoringError && scoringError.code === 'PGRST116') {
                // No settings found, create defaults
                const { data: newSettings } = await supabase
                    .from('habit_scoring_settings')
                    .insert({
                        user_id: user.id,
                        habits_weight: 40,
                        priorities_weight: 35,
                        todos_weight: 25,
                    })
                    .select()
                    .single();

                if (newSettings) {
                    setScoringSettings({
                        habits_weight: newSettings.habits_weight,
                        priorities_weight: newSettings.priorities_weight,
                        todos_weight: newSettings.todos_weight,
                    });
                }
            } else if (scoringData) {
                setScoringSettings({
                    habits_weight: scoringData.habits_weight,
                    priorities_weight: scoringData.priorities_weight,
                    todos_weight: scoringData.todos_weight,
                });
            }

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

    // Count items per day for calendar
    const prioritiesByDate = new Map<string, number>();
    monthPriorities.forEach(p => {
        const count = prioritiesByDate.get(p.date) || 0;
        prioritiesByDate.set(p.date, count + 1);
    });

    const todosByDate = new Map<string, number>();
    monthTodos.forEach(t => {
        const count = todosByDate.get(t.date) || 0;
        todosByDate.set(t.date, count + 1);
    });

    // Count unique habits per day (unique habit_template_ids)
    const habitsByDate = new Map<string, Set<string>>();
    habitEntries.forEach(e => {
        if (!habitsByDate.has(e.date)) {
            habitsByDate.set(e.date, new Set());
        }
        habitsByDate.get(e.date)!.add(e.habit_template_id);
    });
    const habitsCountByDate = new Map<string, number>();
    habitsByDate.forEach((habitSet, date) => {
        habitsCountByDate.set(date, habitSet.size);
    });

    const calendarDays = getDatesInMonth(currentMonth).map(date => {
        const dateStr = formatDate(date);
        return {
            date,
            score: dailyScores.get(dateStr) || null,
            prioritiesCount: prioritiesByDate.get(dateStr) || 0,
            todosCount: todosByDate.get(dateStr) || 0,
            habitsCount: habitsCountByDate.get(dateStr) || 0,
        };
    });

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

            {/* Tabs - Mobile-first: scrollable, larger tap targets */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black">
                <div className="mx-auto max-w-7xl">
                    <div className="flex gap-1 overflow-x-auto px-4 sm:px-6 scrollbar-hide">
                        {(['home', 'calendar', 'daily', 'statistics', 'goals', 'habits'] as Tab[]).map(tab => (
                                <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-4 text-sm font-medium capitalize transition-colors whitespace-nowrap min-h-[48px] flex items-center ${
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

            {/* Content - Mobile-first padding */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
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
                        scoringSettings={scoringSettings}
                        onDataChange={loadData}
                        onScoringSettingsChange={loadData}
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
                    {calendarDays.map(({ date, score, prioritiesCount = 0, todosCount = 0, habitsCount = 0 }) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isToday = isSameDay(date, new Date());
                        const hasData = score || prioritiesCount > 0 || todosCount > 0 || habitsCount > 0;

                        return (
                            <button
                                key={formatDate(date)}
                                onClick={() => onDateSelect(date)}
                                className={`aspect-square border border-slate-200 dark:border-slate-800 p-1.5 text-left transition-colors ${
                                    isSelected
                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                                } ${isToday ? 'ring-2 ring-amber-400' : ''}`}
                            >
                                <div className="text-xs font-medium mb-0.5">{date.getDate()}</div>
                                {hasData && (
                                    <div className="space-y-0.5">
                                        {score && (
                                            <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                {score.grade}
                                            </div>
                                        )}
                                        {(prioritiesCount > 0 || todosCount > 0 || habitsCount > 0) && (
                                            <div className="flex flex-wrap gap-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                                                {habitsCount > 0 && (
                                                    <span className="text-blue-500 dark:text-blue-400">H:{habitsCount}</span>
                                                )}
                                                {prioritiesCount > 0 && (
                                                    <span className="text-purple-500 dark:text-purple-400">P:{prioritiesCount}</span>
                                                )}
                                                {todosCount > 0 && (
                                                    <span className="text-green-500 dark:text-green-400">T:{todosCount}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
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
    scoringSettings,
    onDataChange,
    onScoringSettingsChange,
}: {
    date: Date;
    habitTemplates: HabitTemplate[];
    habitEntries: HabitEntry[];
    priorities: Priority[];
    todos: Todo[];
    dailyContent: DailyContent | null;
    goals: any[];
    scoringSettings: { habits_weight: number; priorities_weight: number; todos_weight: number };
    onDataChange: () => void;
    onScoringSettingsChange: () => void;
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
    const [showScoringModal, setShowScoringModal] = useState(false);
    const [scoringFormData, setScoringFormData] = useState({
        habits_weight: scoringSettings.habits_weight,
        priorities_weight: scoringSettings.priorities_weight,
        todos_weight: scoringSettings.todos_weight,
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

    // Calculate weighted scores: (completed/total) * weight
    const habitsScore = calculateHabitsScore(habitsWithEntries, scoringSettings.habits_weight);
    const prioritiesScore = calculatePrioritiesScore(priorities, scoringSettings.priorities_weight);
    const todosScore = calculateTodosScore(todos, scoringSettings.todos_weight);
    // Overall score is the sum of weighted scores (0-100)
    const overallScore = habitsScore + prioritiesScore + todosScore;
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
        const nextStatus: HabitStatus = currentStatus === 'missed' ? 'checked' : 'missed';
        
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
        if (priorities.length >= 5) return; // Enforce 5 priority limit
        
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
                    <div className="text-right relative group">
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => {
                                    setScoringFormData({
                                        habits_weight: scoringSettings.habits_weight,
                                        priorities_weight: scoringSettings.priorities_weight,
                                        todos_weight: scoringSettings.todos_weight,
                                    });
                                    setShowScoringModal(true);
                                }}
                                className="text-slate-400 hover:text-amber-400 transition-colors"
                                title="Edit scoring weights"
                            >
                                ⚙️
                            </button>
                        </div>
                        <div className="text-5xl font-bold text-amber-400">{overallScore}</div>
                        <div className="text-2xl font-semibold text-amber-300 mt-1">Grade: {grade}</div>
                        <div className="text-lg mt-2">{getVisualScore(overallScore)}</div>
                        <span className="absolute top-0 right-0 text-amber-400 cursor-help" title="Total Score = Habits Score + Priorities Score + Todos Score (0-100)">ℹ️</span>
                        <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-slate-800 text-xs text-slate-200 p-3 rounded shadow-lg z-10 max-w-xs">
                            <div className="font-semibold mb-2">Scoring Formula:</div>
                            <div className="mb-1">Each category: (completed / total) × weight</div>
                            <div className="mb-1">Total Score = Habits + Priorities + Todos</div>
                            <div className="text-slate-400 mt-2">Example: 1/4 habits × 40% = 10 points</div>
                        </div>
                    </div>
                </div>
                
                {/* Component Scores */}
                <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
                    <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-center relative group">
                        <div className="text-xs text-blue-300 mb-1">
                            Habits ({scoringSettings.habits_weight}%)
                            <span className="ml-1 text-blue-400 cursor-help" title="Score = (completed habits / total habits) × weight">ℹ️</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">{habitsScore}</div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-xs text-slate-200 p-2 rounded shadow-lg z-10 whitespace-nowrap">
                            Formula: (completed / total) × {scoringSettings.habits_weight}%
                        </div>
                    </div>
                    <div className="rounded-md border border-purple-500/30 bg-purple-950/20 p-3 text-center relative group">
                        <div className="text-xs text-purple-300 mb-1">
                            Priorities ({scoringSettings.priorities_weight}%)
                            <span className="ml-1 text-purple-400 cursor-help" title="Score = (completed priorities / total priorities) × weight">ℹ️</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-400">{prioritiesScore}</div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-xs text-slate-200 p-2 rounded shadow-lg z-10 whitespace-nowrap">
                            Formula: (completed / total) × {scoringSettings.priorities_weight}%
                        </div>
                    </div>
                    <div className="rounded-md border border-green-500/30 bg-green-950/20 p-3 text-center relative group">
                        <div className="text-xs text-green-300 mb-1">
                            Todos ({scoringSettings.todos_weight}%)
                            <span className="ml-1 text-green-400 cursor-help" title="Score = (completed todos / total todos) × weight">ℹ️</span>
                        </div>
                        <div className="text-2xl font-bold text-green-400">{todosScore}</div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-xs text-slate-200 p-2 rounded shadow-lg z-10 whitespace-nowrap">
                            Formula: (completed / total) × {scoringSettings.todos_weight}%
                        </div>
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
                goals={goals}
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

            {/* Scoring Settings Modal */}
        {showScoringModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScoringModal(false)}>
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Scoring Weights</h3>
                        <button
                            onClick={() => setShowScoringModal(false)}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Info Section */}
                    <div className="mb-4 p-3 bg-slate-800/50 rounded border border-slate-700">
                        <div className="text-xs text-slate-300 mb-2">
                            <div className="font-semibold mb-1">How Scoring Works:</div>
                            <div className="mb-1">• Each category score = (completed items / total items) × weight</div>
                            <div className="mb-1">• Total Score = Habits Score + Priorities Score + Todos Score (0-100)</div>
                            <div className="mb-1">• Grade: A (90-100), B (80-89), C (70-79), D (60-69), F (0-59)</div>
                            <div className="text-slate-400 mt-2">Example: If you complete 2 out of 4 habits with 40% weight, Habits Score = (2/4) × 40 = 20 points</div>
                        </div>
                    </div>

                    {/* Form Inputs */}
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Habits Weight (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={scoringFormData.habits_weight}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setScoringFormData({
                                        ...scoringFormData,
                                        habits_weight: value,
                                    });
                                }}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Priorities Weight (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={scoringFormData.priorities_weight}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setScoringFormData({
                                        ...scoringFormData,
                                        priorities_weight: value,
                                    });
                                }}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">To-Dos Weight (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={scoringFormData.todos_weight}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setScoringFormData({
                                        ...scoringFormData,
                                        todos_weight: value,
                                    });
                                }}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Total Validation */}
                    <div className={`mb-4 text-sm ${Math.abs(scoringFormData.habits_weight + scoringFormData.priorities_weight + scoringFormData.todos_weight - 100) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                        Total: {scoringFormData.habits_weight + scoringFormData.priorities_weight + scoringFormData.todos_weight}% 
                        {Math.abs(scoringFormData.habits_weight + scoringFormData.priorities_weight + scoringFormData.todos_weight - 100) >= 0.01 && (
                            <span className="ml-2">(Must equal 100%)</span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                const total = scoringFormData.habits_weight + scoringFormData.priorities_weight + scoringFormData.todos_weight;
                                if (Math.abs(total - 100) >= 0.01) {
                                    alert('Weights must sum to exactly 100%');
                                    return;
                                }

                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) return;

                                    await supabase
                                        .from('habit_scoring_settings')
                                        .upsert({
                                            user_id: user.id,
                                            habits_weight: scoringFormData.habits_weight,
                                            priorities_weight: scoringFormData.priorities_weight,
                                            todos_weight: scoringFormData.todos_weight,
                                        });

                                    setShowScoringModal(false);
                                    onScoringSettingsChange();
                                } catch (error) {
                                    console.error('Error saving scoring settings:', error);
                                    alert('Error saving settings');
                                }
                            }}
                            disabled={Math.abs(scoringFormData.habits_weight + scoringFormData.priorities_weight + scoringFormData.todos_weight - 100) >= 0.01}
                            className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setShowScoringModal(false)}
                            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
}

// Helper functions for score calculations
// Returns weighted score: (completed/total) * weight
function calculateHabitsScore(habits: Array<{ status: HabitStatus; is_bad_habit?: boolean }>, weight: number): number {
    if (habits.length === 0) return 0;
    let points = 0;
    habits.forEach(h => {
        if (h.is_bad_habit) {
            // For bad habits: missed (avoided) = good, checked (did it) = bad
            if (h.status === 'missed') points += 1; // Avoided the bad habit = success
            // checked = did the bad habit = 0 points
        } else {
            // For good habits: checked = good, missed = bad
            if (h.status === 'checked') points += 1;
        }
    });
    const completionRatio = points / habits.length;
    return Math.round(completionRatio * weight);
}

function calculatePrioritiesScore(priorities: Priority[], weight: number): number {
    if (priorities.length === 0) return 0;
    const completed = priorities.filter(p => p.completed).length;
    const completionRatio = completed / priorities.length;
    return Math.round(completionRatio * weight);
}

function calculateTodosScore(todos: Todo[], weight: number): number {
    if (todos.length === 0) return 0;
    const completed = todos.filter(t => t.is_done).length;
    const completionRatio = completed / todos.length;
    return Math.round(completionRatio * weight);
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
    });
    
    return Math.round((points / timeItems.length) * 100);
}

// Section Components
function HabitsSection({
    habits,
    goals,
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
                            {habitsByCategory[category].map((habit: any) => {
                                const linkedGoal = goals?.find((g: any) => g.id === habit.goal_id);
                                return (
                                    <button
                                        key={habit.id}
                                        onClick={() => onToggle(habit.id, habit.status)}
                                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-900/50 transition-colors text-left"
                                    >
                                        <span className="text-lg">{habit.icon}</span>
                                        <div className="flex-1 flex items-center gap-2">
                                            <span className="text-sm text-slate-200">{habit.name}</span>
                                            {linkedGoal && (
                                                <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                                            )}
                                        </div>
                                        {habit.time_of_day && (
                                            <span className="text-xs text-slate-400 capitalize">{habit.time_of_day}</span>
                                        )}
                                        <span className="text-lg">{getStatusEmoji(habit.status)}</span>
                                    </button>
                                );
                            })}
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
                                            const displayStatus = habit.status === 'missed' ? 'checked' : 'missed';
                                            const linkedGoal = goals?.find((g: any) => g.id === habit.goal_id);
                                            return (
                                                <button
                                                    key={habit.id}
                                                    onClick={() => onToggle(habit.id, habit.status)}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-900/50 transition-colors text-left"
                                                >
                                                    <span className="text-lg">{habit.icon}</span>
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span className="text-sm text-slate-200">{habit.name}</span>
                                                        {linkedGoal && (
                                                            <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                                                        )}
                                                    </div>
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
    const isLimitReached = priorities.length >= 5;
    
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-base font-semibold mb-3 text-purple-400">Priorities (Max 5)</h3>
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
                        onKeyDown={e => e.key === 'Enter' && !isLimitReached && onAdd()}
                        disabled={isLimitReached}
                        className={`flex-1 rounded border border-slate-700 px-2 py-1 text-sm ${
                            isLimitReached 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-slate-900'
                        }`}
                    />
                    <select
                        value={newPriorityCategory || ''}
                        onChange={e => setNewPriorityCategory(e.target.value || null)}
                        disabled={isLimitReached}
                        className={`rounded border border-slate-700 px-2 py-1 text-sm ${
                            isLimitReached 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-slate-900'
                        }`}
                    >
                        <option value="">No Category</option>
                        <option value="physical">Physical</option>
                        <option value="mental">Mental</option>
                        <option value="spiritual">Spiritual</option>
                    </select>
                    <select
                        value={newPriorityTimeOfDay || ''}
                        onChange={e => setNewPriorityTimeOfDay(e.target.value || null)}
                        disabled={isLimitReached}
                        className={`rounded border border-slate-700 px-2 py-1 text-sm ${
                            isLimitReached 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-slate-900'
                        }`}
                    >
                        <option value="">Any Time</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                    </select>
                    <select
                        value={newPriorityGoalId || ''}
                        onChange={e => setNewPriorityGoalId(e.target.value || null)}
                        disabled={isLimitReached}
                        className={`rounded border border-slate-700 px-2 py-1 text-sm ${
                            isLimitReached 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-slate-900'
                        }`}
                        title="Link to goal"
                    >
                        <option value="">No Goal</option>
                        {goals.map((goal: any) => (
                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={onAdd}
                        disabled={isLimitReached}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                            isLimitReached
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-amber-400 text-black hover:bg-amber-300'
                        }`}
                    >
                        Add
                    </button>
                </div>
                {isLimitReached && (
                    <p className="text-xs text-slate-400 mt-2">Maximum of 5 priorities per day allowed</p>
                )}
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
        is_completed: false,
    });
    
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [bulkEditData, setBulkEditData] = useState<{
        category: string | null;
        priority_score: number | null;
        deadline: string | null | '__clear__';
        is_completed: boolean | null;
    }>({
        category: null,
        priority_score: null,
        deadline: null,
        is_completed: null,
    });
    const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
    const [showBulkEditMilestoneModal, setShowBulkEditMilestoneModal] = useState(false);
    const [bulkEditMilestoneData, setBulkEditMilestoneData] = useState<{
        is_completed: boolean | null;
    }>({
        is_completed: null,
    });
    
    const [goalMilestones, setGoalMilestones] = useState<Array<{
        id?: string;
        name: string;
        values: string;
        is_completed?: boolean;
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
    const [linkedPrioritiesCount, setLinkedPrioritiesCount] = useState(0);
    const [linkedTodosCount, setLinkedTodosCount] = useState(0);
    const [showSummarySection, setShowSummarySection] = useState(false);

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
                        is_completed: goalForm.is_completed || false,
                    })
                    .select()
                    .single();
                goalData = data;
            }

            if (!goalData) return;

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
            setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', is_completed: false });
            setGoalMilestones([]);
            setGoalHabits([]);
            setEditingGoal(null);
            setShowGoalForm(false);
            setLinkedPrioritiesCount(0);
            setLinkedTodosCount(0);
            setShowSummarySection(false);
            loadGoals();
            loadHabitTemplates();
        } catch (error) {
            console.error('Error saving goal:', error);
        }
    };

    const handleEditGoal = async (goal: any) => {
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
        
        // Load counts for linked priorities and todos
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { count: prioritiesCount } = await supabase
                    .from('habit_daily_priorities')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('goal_id', goal.id);
                
                const { count: todosCount } = await supabase
                    .from('habit_daily_todos')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('goal_id', goal.id);
                
                setLinkedPrioritiesCount(prioritiesCount || 0);
                setLinkedTodosCount(todosCount || 0);
            }
        } catch (error) {
            console.error('Error loading linked counts:', error);
            setLinkedPrioritiesCount(0);
            setLinkedTodosCount(0);
        }
        
        setShowGoalForm(true);
        setShowSummarySection(false);
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

    const handleToggleSelect = (goalId: string) => {
        const newSelected = new Set(selectedGoals);
        if (newSelected.has(goalId)) {
            newSelected.delete(goalId);
        } else {
            newSelected.add(goalId);
        }
        setSelectedGoals(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedGoals.size === 0) return;
        
        const count = selectedGoals.size;
        if (!confirm(`Are you sure you want to delete ${count} goal${count !== 1 ? 's' : ''}? This will also delete all milestones and linked habits for these goals.`)) {
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const goalIds = Array.from(selectedGoals);
            
            // Delete milestones for these goals
            await supabase
                .from('habit_milestones')
                .delete()
                .in('goal_id', goalIds)
                .eq('user_id', user.id);

            // Delete the goals
            await supabase
                .from('habit_goals')
                .delete()
                .in('id', goalIds)
                .eq('user_id', user.id);
            
            setSelectedGoals(new Set());
            loadGoals();
        } catch (error) {
            console.error('Error deleting goals:', error);
            alert('Error deleting goals. Please try again.');
        }
    };

    const handleBulkEdit = async () => {
        if (selectedGoals.size === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const goalIds = Array.from(selectedGoals);
            const updates: any = {};

            // Only update fields that have been changed (not null)
            if (bulkEditData.category !== null) {
                if (bulkEditData.category === '__clear__') {
                    updates.category = null;
                } else {
                    updates.category = bulkEditData.category || null;
                }
            }
            if (bulkEditData.priority_score !== null) {
                updates.priority_score = bulkEditData.priority_score;
            }
            if (bulkEditData.deadline !== null) {
                if (bulkEditData.deadline === '__clear__') {
                    updates.deadline = null;
                } else {
                    updates.deadline = bulkEditData.deadline || null;
                }
            }
            if (bulkEditData.is_completed !== null) {
                updates.is_completed = bulkEditData.is_completed;
            }

            if (Object.keys(updates).length === 0) {
                alert('Please select at least one field to update.');
                return;
            }

            await supabase
                .from('habit_goals')
                .update(updates)
                .in('id', goalIds)
                .eq('user_id', user.id);

            setShowBulkEditModal(false);
            setBulkEditData({
                category: null,
                priority_score: null,
                deadline: null,
                is_completed: null,
            });
            setSelectedGoals(new Set());
            loadGoals();
        } catch (error) {
            console.error('Error updating goals:', error);
            alert('Error updating goals. Please try again.');
        }
    };

    const handleToggleSelectMilestone = (milestoneId: string) => {
        const newSelected = new Set(selectedMilestones);
        if (newSelected.has(milestoneId)) {
            newSelected.delete(milestoneId);
        } else {
            newSelected.add(milestoneId);
        }
        setSelectedMilestones(newSelected);
    };

    const handleBulkDeleteMilestones = async () => {
        if (selectedMilestones.size === 0) return;
        
        const count = selectedMilestones.size;
        if (!confirm(`Are you sure you want to delete ${count} milestone${count !== 1 ? 's' : ''}?`)) {
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const milestoneIds = Array.from(selectedMilestones);
            await supabase
                .from('habit_milestones')
                .delete()
                .in('id', milestoneIds)
                .eq('user_id', user.id);
            
            setSelectedMilestones(new Set());
            loadGoals();
        } catch (error) {
            console.error('Error deleting milestones:', error);
            alert('Error deleting milestones. Please try again.');
        }
    };

    const handleBulkEditMilestones = async () => {
        if (selectedMilestones.size === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const milestoneIds = Array.from(selectedMilestones);
            const updates: any = {};

            if (bulkEditMilestoneData.is_completed !== null) {
                updates.is_completed = bulkEditMilestoneData.is_completed;
            }

            if (Object.keys(updates).length === 0) {
                alert('Please select at least one field to update.');
                return;
            }

            await supabase
                .from('habit_milestones')
                .update(updates)
                .in('id', milestoneIds)
                .eq('user_id', user.id);

            setShowBulkEditMilestoneModal(false);
            setBulkEditMilestoneData({
                is_completed: null,
            });
            setSelectedMilestones(new Set());
            loadGoals();
        } catch (error) {
            console.error('Error updating milestones:', error);
            alert('Error updating milestones. Please try again.');
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
    
    // Sort goals by priority: priority > 0 descending, then priority 0 at bottom
    const sortedGoals = [...filteredGoals].sort((a, b) => {
        const aPriority = a.priority_score || 0;
        const bPriority = b.priority_score || 0;
        // If both are 0, maintain order
        if (aPriority === 0 && bPriority === 0) return 0;
        // If one is 0, it goes to bottom
        if (aPriority === 0) return 1;
        if (bPriority === 0) return -1;
        // Otherwise sort descending
        return bPriority - aPriority;
    });
    
    const mainGoals = sortedGoals;
    
    // Group goals by category for "all" view
    const goalsByCategory = goalCategories.reduce((acc, cat) => {
        acc[cat] = goals.filter(g => g.category === cat);
        return acc;
    }, {} as Record<string, typeof goals>);
    
    const uncategorizedGoals = goals.filter(g => !g.category);

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Goals & Milestones</h2>
                <div className="flex gap-2 items-center">
                    {selectedGoals.size > 0 && (
                        <>
                            <span className="text-sm text-slate-400">{selectedGoals.size} selected</span>
                            <button
                                onClick={() => {
                                    setBulkEditData({
                                        category: null,
                                        priority_score: null,
                                        deadline: null,
                                        is_completed: null,
                                    });
                                    setShowBulkEditModal(true);
                                }}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Bulk Edit
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Delete Selected
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => {
                            setShowArchived(!showArchived);
                            setEditingGoal(null);
                            setShowGoalForm(false);
                            setGoalMilestones([]);
                            setSelectedGoals(new Set());
                            setSelectedMilestones(new Set());
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
                            setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', is_completed: false });
                            setGoalMilestones([]);
                            setGoalHabits([]);
                            setLinkedPrioritiesCount(0);
                            setLinkedTodosCount(0);
                            setShowSummarySection(false);
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
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-slate-400">Priority (1-5, 5 = highest)</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((priority) => (
                                        <button
                                            key={priority}
                                            type="button"
                                            onClick={() => setGoalForm({ ...goalForm, priority_score: priority })}
                                            className={`flex-1 rounded border px-2 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                                                goalForm.priority_score === priority
                                                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                                            }`}
                                        >
                                            {priority}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="date"
                                placeholder="Deadline"
                                value={goalForm.deadline || ''}
                                onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value || null })}
                                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-3 text-sm min-h-[48px]"
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

                    {/* Milestones & Links Summary Section */}
                    {editingGoal && (
                        <div className="border-t border-slate-800 pt-4">
                            <div className="w-full flex items-center justify-between p-3 rounded border border-slate-700 bg-slate-900">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newExpanded = !showSummarySection;
                                        setShowSummarySection(newExpanded);
                                        if (newExpanded) {
                                            // Scroll to the Habits section after a brief delay to allow DOM update
                                            setTimeout(() => {
                                                const habitsSection = document.getElementById('goal-form-habits-section');
                                                if (habitsSection) {
                                                    habitsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }, 100);
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">Milestones & Links</span>
                                        <span className="text-xs text-slate-400">
                                            {goalMilestones.length} milestone{goalMilestones.length !== 1 ? 's' : ''}, {goalHabits.length} habit{goalHabits.length !== 1 ? 's' : ''}
                                            {linkedPrioritiesCount > 0 && `, ${linkedPrioritiesCount} priorit${linkedPrioritiesCount !== 1 ? 'ies' : 'y'} linked`}
                                            {linkedTodosCount > 0 && `, ${linkedTodosCount} todo${linkedTodosCount !== 1 ? 's' : ''} linked`}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400 ml-2">{showSummarySection ? '▼' : '▶'}</span>
                                </button>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Scroll to habits section and trigger add
                                            setTimeout(() => {
                                                const habitsSection = document.getElementById('goal-form-habits-section');
                                                if (habitsSection) {
                                                    habitsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    setTimeout(() => {
                                                        addHabitToForm();
                                                    }, 300);
                                                }
                                            }, 100);
                                        }}
                                        className="text-xs text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-800"
                                        title="Add habit"
                                    >
                                        <span className="text-lg leading-none">+</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Habits Section */}
                    <div id="goal-form-habits-section" className="border-t border-slate-800 pt-4">
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
                    <div id="goal-form-milestones-section" className="border-t border-slate-800 pt-4">
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
                                setGoalForm({ name: '', description: '', category: null, priority_score: 0, deadline: '', target_value: '', target_unit: '', current_value: '', is_completed: false });
                                setGoalMilestones([]);
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
                            
                            const categorySelectedCount = categoryGoals.filter(g => selectedGoals.has(g.id)).length;
                            const allCategorySelected = categoryGoals.length > 0 && categorySelectedCount === categoryGoals.length;
                            const someCategorySelected = categorySelectedCount > 0 && categorySelectedCount < categoryGoals.length;
                            
                            return (
                                <div key={category}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold capitalize text-slate-300">
                                            {category.charAt(0).toUpperCase() + category.slice(1)} Goals
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={allCategorySelected}
                                                onChange={(e) => {
                                                    e.target.indeterminate = false;
                                                    if (allCategorySelected) {
                                                        const newSelected = new Set(selectedGoals);
                                                        categoryGoals.forEach(g => newSelected.delete(g.id));
                                                        setSelectedGoals(newSelected);
                                                    } else {
                                                        const newSelected = new Set(selectedGoals);
                                                        categoryGoals.forEach(g => newSelected.add(g.id));
                                                        setSelectedGoals(newSelected);
                                                    }
                                                }}
                                                ref={(input) => {
                                                    if (input) input.indeterminate = someCategorySelected;
                                                }}
                                                className="rounded border-slate-600"
                                            />
                                            <span className="text-xs text-slate-400">Select All</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {categoryGoals.map(goal => {
                                            const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                                            const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                                            return (
                                                <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedGoals.has(goal.id)}
                                                                onChange={() => handleToggleSelect(goal.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="rounded border-slate-600"
                                                            />
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-lg font-semibold">{goal.name}</h3>
                                                                    {(() => {
                                                                        const priority = goal.priority_score || 0;
                                                                        const getPriorityBadgeColor = (priority: number) => {
                                                                            if (priority === 0) return 'bg-slate-600 text-slate-300';
                                                                            if (priority === 5) return 'bg-red-500 text-white';
                                                                            if (priority === 4) return 'bg-orange-500 text-white';
                                                                            if (priority === 3) return 'bg-yellow-500 text-black';
                                                                            if (priority === 2) return 'bg-slate-500 text-white';
                                                                            return 'bg-slate-600 text-slate-300'; // priority === 1 or 0
                                                                        };
                                                                        return (
                                                                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getPriorityBadgeColor(priority)}`}>
                                                                                {priority}
                                                                            </span>
                                                                        );
                                                                    })()}
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

{goalMilestones.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="text-xs text-slate-400">Milestones:</div>
                                                                {!showArchived && selectedMilestones.size > 0 && (
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                setBulkEditMilestoneData({ is_completed: null });
                                                                                setShowBulkEditMilestoneModal(true);
                                                                            }}
                                                                            className="text-xs text-blue-400 hover:text-blue-300"
                                                                        >
                                                                            Bulk Edit ({selectedMilestones.size})
                                                                        </button>
                                                                        <button
                                                                            onClick={handleBulkDeleteMilestones}
                                                                            className="text-xs text-red-400 hover:text-red-300"
                                                                        >
                                                                            Delete ({selectedMilestones.size})
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {goalMilestones.map(milestone => (
                                                                <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                                                    <div className="flex items-center gap-2 flex-1">
                                                                        {!showArchived && (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedMilestones.has(milestone.id)}
                                                                                onChange={() => handleToggleSelectMilestone(milestone.id)}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="rounded border-slate-600"
                                                                            />
                                                                        )}
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
                                        const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                                        const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                                        return (
                                            <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedGoals.has(goal.id)}
                                                            onChange={() => handleToggleSelect(goal.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="rounded border-slate-600"
                                                        />
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


                                                {goalMilestones.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="text-xs text-slate-400">Milestones:</div>
                                                            {!showArchived && selectedMilestones.size > 0 && (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setBulkEditMilestoneData({ is_completed: null });
                                                                            setShowBulkEditMilestoneModal(true);
                                                                        }}
                                                                        className="text-xs text-blue-400 hover:text-blue-300"
                                                                    >
                                                                        Bulk Edit ({selectedMilestones.size})
                                                                    </button>
                                                                    <button
                                                                        onClick={handleBulkDeleteMilestones}
                                                                        className="text-xs text-red-400 hover:text-red-300"
                                                                    >
                                                                        Delete ({selectedMilestones.size})
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {goalMilestones.map(milestone => (
                                                            <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    {!showArchived && (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedMilestones.has(milestone.id)}
                                                                            onChange={() => handleToggleSelectMilestone(milestone.id)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="rounded border-slate-600"
                                                                        />
                                                                    )}
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
                    const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                    const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;

                    return (
                        <div key={goal.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold">{goal.name}</h3>
                                        {(() => {
                                            const priority = goal.priority_score || 0;
                                                                        const getPriorityBadgeColor = (priority: number) => {
                                                                            if (priority === 0) return 'bg-slate-600 text-slate-300';
                                                                            if (priority === 5) return 'bg-red-500 text-white';
                                                                            if (priority === 4) return 'bg-orange-500 text-white';
                                                                            if (priority === 3) return 'bg-yellow-500 text-black';
                                                                            if (priority === 2) return 'bg-slate-500 text-white';
                                                                            return 'bg-slate-600 text-slate-300'; // priority === 1 or 0
                                                                        };
                                            return (
                                                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getPriorityBadgeColor(priority)}`}>
                                                    {priority}
                                                </span>
                                            );
                                        })()}
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


                            {goalMilestones.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-xs text-slate-400">Milestones:</div>
                                        {!showArchived && selectedMilestones.size > 0 && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        setBulkEditMilestoneData({ is_completed: null });
                                                        setShowBulkEditMilestoneModal(true);
                                                    }}
                                                    className="text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    Bulk Edit ({selectedMilestones.size})
                                                </button>
                                                <button
                                                    onClick={handleBulkDeleteMilestones}
                                                    className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                    Delete ({selectedMilestones.size})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {goalMilestones.map(milestone => (
                                        <div key={milestone.id} className="flex items-center justify-between text-sm text-slate-300">
                                            <div className="flex items-center gap-2 flex-1">
                                                {!showArchived && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMilestones.has(milestone.id)}
                                                        onChange={() => handleToggleSelectMilestone(milestone.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded border-slate-600"
                                                    />
                                                )}
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

            {/* Bulk Edit Modal for Goals */}
            {showBulkEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkEditModal(false)}>
                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Bulk Edit Goals</h3>
                            <button
                                onClick={() => setShowBulkEditModal(false)}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-slate-400 mb-4">
                            Update {selectedGoals.size} selected goal{selectedGoals.size !== 1 ? 's' : ''}. Leave fields unchanged to keep current values.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Category</label>
                                <select
                                    value={bulkEditData.category || ''}
                                    onChange={(e) => setBulkEditData({ ...bulkEditData, category: e.target.value || null })}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="__clear__">-- Remove category --</option>
                                    {goalCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">Priority (1-5, 5 = highest)</label>
                                <div className="flex gap-2 mb-2">
                                    {[1, 2, 3, 4, 5].map((priority) => (
                                        <button
                                            key={priority}
                                            type="button"
                                            onClick={() => setBulkEditData({ ...bulkEditData, priority_score: priority })}
                                            className={`flex-1 rounded border px-2 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                                                bulkEditData.priority_score === priority
                                                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                            }`}
                                        >
                                            {priority}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setBulkEditData({ ...bulkEditData, priority_score: null })}
                                    className="w-full text-xs text-slate-400 hover:text-slate-200 py-1"
                                >
                                    Clear / Keep current
                                </button>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Deadline</label>
                                <input
                                    type="date"
                                    value={bulkEditData.deadline === '__clear__' ? '' : (bulkEditData.deadline || '')}
                                    onChange={(e) => setBulkEditData({ ...bulkEditData, deadline: e.target.value || null })}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                />
                                {bulkEditData.deadline !== null && (
                                    <button
                                        onClick={() => setBulkEditData({ ...bulkEditData, deadline: '__clear__' as any })}
                                        className="mt-2 text-xs text-slate-400 hover:text-slate-300"
                                    >
                                        Clear deadline
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Completion Status</label>
                                <select
                                    value={bulkEditData.is_completed === null ? '' : bulkEditData.is_completed ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBulkEditData({
                                            ...bulkEditData,
                                            is_completed: value === '' ? null : value === 'true'
                                        });
                                    }}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="false">Not Completed</option>
                                    <option value="true">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handleBulkEdit}
                                className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                            >
                                Apply Changes
                            </button>
                            <button
                                onClick={() => setShowBulkEditModal(false)}
                                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Edit Modal for Milestones */}
            {showBulkEditMilestoneModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkEditMilestoneModal(false)}>
                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Bulk Edit Milestones</h3>
                            <button
                                onClick={() => setShowBulkEditMilestoneModal(false)}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-slate-400 mb-4">
                            Update {selectedMilestones.size} selected milestone{selectedMilestones.size !== 1 ? 's' : ''}. Leave fields unchanged to keep current values.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Completion Status</label>
                                <select
                                    value={bulkEditMilestoneData.is_completed === null ? '' : bulkEditMilestoneData.is_completed ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBulkEditMilestoneData({
                                            ...bulkEditMilestoneData,
                                            is_completed: value === '' ? null : value === 'true'
                                        });
                                    }}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="false">Not Completed</option>
                                    <option value="true">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handleBulkEditMilestones}
                                className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                            >
                                Apply Changes
                            </button>
                            <button
                                onClick={() => setShowBulkEditMilestoneModal(false)}
                                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set());
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [bulkEditData, setBulkEditData] = useState<{
        goal_id: string | null;
        category: Category | null;
        time_of_day: TimeOfDay | null | string;
        is_bad_habit: boolean | null;
    }>({
        goal_id: null,
        category: null,
        time_of_day: null,
        is_bad_habit: null,
    });

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
                .eq('is_completed', false)
                .eq('is_archived', false)
                .order('name');

            setGoals(goalsData || []);
        } catch (error) {
            console.error('Error loading goals:', error);
        }
    };

    const handleEdit = (habit: HabitTemplate) => {
        setEditingHabit(habit);
        setFormData({
            name: habit.name || '',
            icon: habit.icon || '📝',
            category: habit.category || 'mental',
            time_of_day: habit.time_of_day || null,
            is_bad_habit: habit.is_bad_habit || false,
            goal_id: habit.goal_id || null,
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

    const handleBulkDelete = async () => {
        if (selectedHabits.size === 0) return;
        
        const count = selectedHabits.size;
        if (!confirm(`Are you sure you want to delete ${count} habit${count !== 1 ? 's' : ''}? This will also delete all daily entries for these habits.`)) {
            return;
        }

        try {
            const habitIds = Array.from(selectedHabits);
            await supabase
                .from('habit_templates')
                .delete()
                .in('id', habitIds);
            
            setSelectedHabits(new Set());
            onDataChange();
        } catch (error) {
            console.error('Error deleting habits:', error);
            alert('Error deleting habits. Please try again.');
        }
    };

    const handleBulkEdit = async () => {
        if (selectedHabits.size === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const habitIds = Array.from(selectedHabits);
            const updates: any = {};

            // Only update fields that have been changed (not null)
            if (bulkEditData.goal_id !== null) {
                if (bulkEditData.goal_id === '__clear__') {
                    updates.goal_id = null;
                } else {
                    updates.goal_id = bulkEditData.goal_id || null;
                }
            }
            if (bulkEditData.category !== null) {
                updates.category = bulkEditData.category;
            }
            if (bulkEditData.time_of_day !== null) {
                if (bulkEditData.time_of_day === '__clear__' as any) {
                    updates.time_of_day = null;
                } else {
                    updates.time_of_day = bulkEditData.time_of_day as TimeOfDay;
                }
            }
            if (bulkEditData.is_bad_habit !== null) {
                updates.is_bad_habit = bulkEditData.is_bad_habit;
            }

            if (Object.keys(updates).length === 0) {
                alert('Please select at least one field to update.');
                return;
            }

            await supabase
                .from('habit_templates')
                .update(updates)
                .in('id', habitIds);

            setShowBulkEditModal(false);
            setBulkEditData({
                goal_id: null,
                category: null,
                time_of_day: null,
                is_bad_habit: null,
            });
            setSelectedHabits(new Set());
            onDataChange();
        } catch (error) {
            console.error('Error updating habits:', error);
            alert('Error updating habits. Please try again.');
        }
    };

    const handleToggleSelect = (habitId: string) => {
        const newSelected = new Set(selectedHabits);
        if (newSelected.has(habitId)) {
            newSelected.delete(habitId);
        } else {
            newSelected.add(habitId);
        }
        setSelectedHabits(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedHabits.size === filteredHabits.length) {
            setSelectedHabits(new Set());
        } else {
            setSelectedHabits(new Set(filteredHabits.map(h => h.id)));
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

    // Clear selection when filters change
    useEffect(() => {
        setSelectedHabits(new Set());
    }, [filter, categoryFilter]);

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

            {/* Filters and Bulk Actions */}
            <div className="flex gap-2 items-center justify-between">
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
                {selectedHabits.size > 0 && (
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-slate-400">{selectedHabits.size} selected</span>
                        <button
                            onClick={() => {
                                setBulkEditData({
                                    goal_id: null,
                                    category: null,
                                    time_of_day: null,
                                    is_bad_habit: null,
                                });
                                setShowBulkEditModal(true);
                            }}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Bulk Edit
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                            Delete Selected
                        </button>
                    </div>
                )}
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
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Link to goal (optional)</label>
                        <select
                            value={formData.goal_id || ''}
                            onChange={e => setFormData({ ...formData, goal_id: e.target.value || null })}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                        >
                            <option value="">No goal</option>
                            {goals.map(goal => (
                                <option key={goal.id} value={goal.id}>{goal.name}</option>
                            ))}
                        </select>
                    </div>
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

                    const categorySelectedCount = categoryHabits.filter(h => selectedHabits.has(h.id)).length;
                    const allCategorySelected = categoryHabits.length > 0 && categorySelectedCount === categoryHabits.length;
                    const someCategorySelected = categorySelectedCount > 0 && categorySelectedCount < categoryHabits.length;

                    return (
                        <div key={category} className={`rounded-lg border ${categoryColors[category]} p-4`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold capitalize">{category} Habits</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={allCategorySelected}
                                        onChange={(e) => {
                                            e.target.indeterminate = false;
                                            if (allCategorySelected) {
                                                // Deselect all in this category
                                                const newSelected = new Set(selectedHabits);
                                                categoryHabits.forEach(h => newSelected.delete(h.id));
                                                setSelectedHabits(newSelected);
                                            } else {
                                                // Select all in this category
                                                const newSelected = new Set(selectedHabits);
                                                categoryHabits.forEach(h => newSelected.add(h.id));
                                                setSelectedHabits(newSelected);
                                            }
                                        }}
                                        ref={(input) => {
                                            if (input) input.indeterminate = someCategorySelected;
                                        }}
                                        className="rounded border-slate-600"
                                    />
                                    <span className="text-xs text-slate-400">Select All</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {categoryHabits.map(habit => (
                                    <div
                                        key={habit.id}
                                        className="flex items-center justify-between p-2 rounded bg-slate-900/50 hover:bg-slate-900 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedHabits.has(habit.id)}
                                                onChange={() => handleToggleSelect(habit.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded border-slate-600"
                                            />
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

            {/* Bulk Edit Modal */}
            {showBulkEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkEditModal(false)}>
                    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Bulk Edit Habits</h3>
                            <button
                                onClick={() => setShowBulkEditModal(false)}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-sm text-slate-400 mb-4">
                            Update {selectedHabits.size} selected habit{selectedHabits.size !== 1 ? 's' : ''}. Leave fields unchanged to keep current values.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Link to Goal</label>
                                <select
                                    value={bulkEditData.goal_id || ''}
                                    onChange={(e) => setBulkEditData({ ...bulkEditData, goal_id: e.target.value || null })}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="__clear__">-- Remove goal link --</option>
                                    {goals.map(goal => (
                                        <option key={goal.id} value={goal.id}>{goal.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Category</label>
                                <select
                                    value={bulkEditData.category || ''}
                                    onChange={(e) => setBulkEditData({ ...bulkEditData, category: (e.target.value as Category) || null })}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="physical">Physical</option>
                                    <option value="mental">Mental</option>
                                    <option value="spiritual">Spiritual</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Time of Day</label>
                                <select
                                    value={(bulkEditData.time_of_day as string) === '__clear__' ? '__clear__' : (bulkEditData.time_of_day || '')}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBulkEditData({
                                            ...bulkEditData,
                                            time_of_day: value === '' ? null : (value === '__clear__' ? '__clear__' as any : (value as TimeOfDay))
                                        });
                                    }}
                                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="__clear__">-- Remove time of day --</option>
                                    <option value="morning">Morning</option>
                                    <option value="afternoon">Afternoon</option>
                                    <option value="evening">Evening</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-400">Bad Habit Status</label>
                                <select
                                    value={bulkEditData.is_bad_habit === null ? '' : bulkEditData.is_bad_habit ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBulkEditData({
                                            ...bulkEditData,
                                            is_bad_habit: value === '' ? null : value === 'true'
                                        });
                                    }}
                                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                >
                                    <option value="">-- Keep current / No change --</option>
                                    <option value="false">Good Habit</option>
                                    <option value="true">Bad Habit</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handleBulkEdit}
                                className="flex-1 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300"
                            >
                                Apply Changes
                            </button>
                            <button
                                onClick={() => setShowBulkEditModal(false)}
                                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
