'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import {
    formatDate,
    isSameDay,
    getVisualScore,
    getGrade,
    type Category,
    type TimeOfDay,
    type HabitStatus,
    calculateItemScore,
} from '@/lib/habitHelpers';

type Goal = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    priority_score: number;
    deadline: string | null;
    is_completed: boolean;
};

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: Category;
    time_of_day: TimeOfDay | null;
    goal_id: string | null;
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
    date: string;
};

type Todo = {
    id: string;
    title: string;
    category: Category | null;
    time_of_day: TimeOfDay | null;
    is_done: boolean;
    goal_id: string | null;
    date: string;
};

type DailyContent = {
    lessons: string | null;
    ideas: string | null;
    notes: string | null;
    distractions: string | null;
    reflection: string | null;
    news_updates: string | null;
};

type DailyScore = {
    score_overall: number;
    grade: string;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
};

export default function LifeTrackerHome() {
    const [loading, setLoading] = useState(true);
    
    // Goals data
    const [goals, setGoals] = useState<Goal[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    
    // Calendar data
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailyScores, setDailyScores] = useState<Map<string, DailyScore>>(new Map());
    const [weekPriorities, setWeekPriorities] = useState<Map<string, Priority[]>>(new Map());
    const [weekTodos, setWeekTodos] = useState<Map<string, Todo[]>>(new Map());
    const [weekHabits, setWeekHabits] = useState<Map<string, number>>(new Map());
    
    // Daily Plan data
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [dailyContent, setDailyContent] = useState<DailyContent | null>(null);
    
    // Scoring settings
    const [scoringSettings, setScoringSettings] = useState({
        habits_weight: 40,
        priorities_weight: 35,
        todos_weight: 25,
    });

    useEffect(() => {
        loadAllData();
    }, [selectedDate, currentWeek]);

    const loadAllData = async () => {
        setLoading(true);
        await Promise.all([
            loadGoals(),
            loadScoringSettings(),
            loadCalendarData(),
            loadDailyPlanData(),
        ]);
        setLoading(false);
    };

    const loadGoals = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('habit_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .eq('is_archived', false)
                .order('priority_score', { ascending: false })
                .limit(5);

            setGoals(data || []);
        } catch (error) {
            console.error('Error loading goals:', error);
        }
    };

    const loadScoringSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('habit_scoring_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code === 'PGRST116') {
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
            } else if (data) {
                setScoringSettings({
                    habits_weight: data.habits_weight,
                    priorities_weight: data.priorities_weight,
                    todos_weight: data.todos_weight,
                });
            }
        } catch (error) {
            console.error('Error loading scoring settings:', error);
        }
    };

    const loadCalendarData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const weekStart = getWeekStart(currentWeek);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekStartStr = formatDate(weekStart);
            const weekEndStr = formatDate(weekEnd);

            // Load scores
            const { data: scoresData } = await supabase
                .from('habit_daily_scores')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStr);

            const scoresMap = new Map<string, DailyScore>();
            scoresData?.forEach(score => {
                scoresMap.set(score.date, {
                    score_overall: score.score_overall,
                    grade: score.grade,
                    score_habits: score.score_habits,
                    score_priorities: score.score_priorities,
                    score_todos: score.score_todos,
                });
            });
            setDailyScores(scoresMap);

            // Load priorities and todos for the week
            const { data: prioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStr);

            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStr);

            // Load habit entries for the week
            const { data: habitEntriesData } = await supabase
                .from('habit_daily_entries')
                .select('date, habit_template_id')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStr);

            const prioritiesMap = new Map<string, Priority[]>();
            prioritiesData?.forEach(p => {
                const existing = prioritiesMap.get(p.date) || [];
                prioritiesMap.set(p.date, [...existing, p]);
            });
            setWeekPriorities(prioritiesMap);

            const todosMap = new Map<string, Todo[]>();
            todosData?.forEach(t => {
                const existing = todosMap.get(t.date) || [];
                todosMap.set(t.date, [...existing, t]);
            });
            setWeekTodos(todosMap);

            // Count unique habits per day
            const habitsByDate = new Map<string, Set<string>>();
            habitEntriesData?.forEach(e => {
                if (!habitsByDate.has(e.date)) {
                    habitsByDate.set(e.date, new Set());
                }
                habitsByDate.get(e.date)!.add(e.habit_template_id);
            });
            const habitsCountMap = new Map<string, number>();
            habitsByDate.forEach((habitSet, date) => {
                habitsCountMap.set(date, habitSet.size);
            });
            setWeekHabits(habitsCountMap);
        } catch (error) {
            console.error('Error loading calendar data:', error);
        }
    };

    const loadDailyPlanData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const dateStr = formatDate(selectedDate);

            // Load habit templates
            const { data: templates } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('sort_order');

            // Load habit entries for selected date
            const { data: entries } = await supabase
                .from('habit_daily_entries')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr);

            // Load priorities
            const { data: prioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .order('sort_order');

            // Load todos
            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .order('created_at');

            // Load daily content
            const { data: contentData } = await supabase
                .from('habit_daily_content')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .single();

            setHabitTemplates(templates || []);
            setHabitEntries(entries || []);
            setPriorities(prioritiesData || []);
            setTodos(todosData || []);
            setDailyContent(contentData || null);
        } catch (error) {
            console.error('Error loading daily plan data:', error);
        }
    };

    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const getWeekDays = (): Date[] => {
        const start = getWeekStart(currentWeek);
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        return days;
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading...</div>;
    }

    return (
        <div className="space-y-12">
            {/* 1. GOALS SECTION */}
            <GoalsSection
                goals={goals}
                onGoalClick={(goalId) => setSelectedGoalId(goalId)}
                onRefresh={loadGoals}
            />

            {/* 2. CALENDAR OVERVIEW SECTION */}
            <CalendarOverviewSection
                currentWeek={currentWeek}
                selectedDate={selectedDate}
                dailyScores={dailyScores}
                weekPriorities={weekPriorities}
                weekTodos={weekTodos}
                weekHabits={weekHabits}
                onDateSelect={setSelectedDate}
                onWeekChange={(direction) => {
                    const newWeek = new Date(currentWeek);
                    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
                    setCurrentWeek(newWeek);
                }}
            />

            {/* 3. DAILY PLAN SECTION */}
            <DailyPlanSection
                date={selectedDate}
                habitTemplates={habitTemplates}
                habitEntries={habitEntries}
                priorities={priorities}
                todos={todos}
                dailyContent={dailyContent}
                goals={goals}
                scoringSettings={scoringSettings}
                onDataChange={loadDailyPlanData}
            />

            {/* Goal Detail Modal */}
            {selectedGoalId && (
                <GoalDetailModal
                    goalId={selectedGoalId}
                    goals={goals}
                    onClose={() => setSelectedGoalId(null)}
                    onRefresh={loadGoals}
                />
            )}
        </div>
    );
}

// Goals Section Component
function GoalsSection({
    goals,
    onGoalClick,
    onRefresh,
}: {
    goals: Goal[];
    onGoalClick: (goalId: string) => void;
    onRefresh: () => void;
}) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newGoal, setNewGoal] = useState({
        name: '',
        description: '',
        category: '',
        priority_score: 0,
        deadline: '',
    });

    const handleAddGoal = async () => {
        if (!newGoal.name.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_goals')
                .insert({
                    user_id: user.id,
                    name: newGoal.name,
                    description: newGoal.description || null,
                    category: newGoal.category || null,
                    priority_score: newGoal.priority_score,
                    deadline: newGoal.deadline || null,
                    is_completed: false,
                });

            setNewGoal({
                name: '',
                description: '',
                category: '',
                priority_score: 0,
                deadline: '',
            });
            setShowAddForm(false);
            onRefresh();
        } catch (error) {
            console.error('Error adding goal:', error);
        }
    };

    const categoryColors: Record<string, string> = {
        career: 'border-blue-500/30 bg-blue-950/20',
        financial: 'border-green-500/30 bg-green-950/20',
        spiritual: 'border-amber-500/30 bg-amber-950/20',
        physical: 'border-red-500/30 bg-red-950/20',
        mental: 'border-purple-500/30 bg-purple-950/20',
        health: 'border-pink-500/30 bg-pink-950/20',
        personal: 'border-cyan-500/30 bg-cyan-950/20',
        relationships: 'border-rose-500/30 bg-rose-950/20',
        education: 'border-indigo-500/30 bg-indigo-950/20',
        other: 'border-slate-500/30 bg-slate-950/20',
    };

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">Goals</h2>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="rounded-md border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-sm font-medium text-amber-400 hover:bg-amber-950/30 active:bg-amber-950/40 transition-colors min-h-[44px]"
                >
                    {showAddForm ? 'Cancel' : '+ Add Goal'}
                </button>
            </div>

            {showAddForm && (
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
                    <input
                        type="text"
                        placeholder="Goal title"
                        value={newGoal.name}
                        onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none min-h-[48px]"
                    />
                    <textarea
                        placeholder="Description (optional)"
                        value={newGoal.description}
                        onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none min-h-[80px]"
                        rows={2}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                            value={newGoal.category}
                            onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none min-h-[48px]"
                        >
                            <option value="">Category</option>
                            <option value="career">Career</option>
                            <option value="financial">Financial</option>
                            <option value="spiritual">Spiritual</option>
                            <option value="physical">Physical</option>
                            <option value="mental">Mental</option>
                            <option value="health">Health</option>
                            <option value="personal">Personal</option>
                            <option value="relationships">Relationships</option>
                            <option value="education">Education</option>
                            <option value="other">Other</option>
                        </select>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-slate-400">Priority (1-5, 5 = highest)</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((priority) => (
                                    <button
                                        key={priority}
                                        type="button"
                                        onClick={() => setNewGoal({ ...newGoal, priority_score: priority })}
                                        className={`flex-1 rounded-md border px-2 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                                            newGoal.priority_score === priority
                                                ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        {priority}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <input
                        type="date"
                        placeholder="Deadline"
                        value={newGoal.deadline}
                        onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none min-h-[48px]"
                    />
                    <button
                        onClick={handleAddGoal}
                        className="w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-medium text-black hover:bg-amber-400 active:bg-amber-600 transition-colors min-h-[48px]"
                    >
                        Add Goal
                    </button>
                </div>
            )}

            <div className="space-y-2">
                {goals.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">No goals yet. Add your first goal above!</p>
                ) : (
                    // Sort goals: priority > 0 descending, then priority 0 at bottom
                    [...goals].sort((a, b) => {
                        const aPriority = a.priority_score || 0;
                        const bPriority = b.priority_score || 0;
                        // If both are 0, maintain order
                        if (aPriority === 0 && bPriority === 0) return 0;
                        // If one is 0, it goes to bottom
                        if (aPriority === 0) return 1;
                        if (bPriority === 0) return -1;
                        // Otherwise sort descending
                        return bPriority - aPriority;
                    }).map((goal) => {
                        const priority = goal.priority_score || 0;
                        const getPriorityBadgeColor = (priority: number) => {
                            if (priority === 0) return 'bg-slate-600 text-slate-300';
                            if (priority >= 50) return 'bg-red-500 text-white';
                            if (priority >= 20) return 'bg-yellow-500 text-black';
                            return 'bg-slate-500 text-white';
                        };
                        
                        return (
                            <button
                                key={goal.id}
                                onClick={() => onGoalClick(goal.id)}
                                className={`w-full rounded-lg border p-4 text-left transition-colors hover:border-amber-500/50 ${
                                    categoryColors[goal.category || 'other'] || categoryColors.other
                                } border-slate-700`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-white">{goal.name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getPriorityBadgeColor(priority)}`}>
                                                {priority}
                                            </span>
                                        </div>
                                        {goal.description && (
                                            <p className="text-sm text-slate-300 mb-2">{goal.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                            {goal.category && (
                                                <span className="capitalize">{goal.category}</span>
                                            )}
                                            {goal.deadline && (
                                                <span>Deadline: {new Date(goal.deadline).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </section>
    );
}

// Calendar Overview Section Component
function CalendarOverviewSection({
    currentWeek,
    selectedDate,
    dailyScores,
    weekPriorities,
    weekTodos,
    weekHabits,
    onDateSelect,
    onWeekChange,
}: {
    currentWeek: Date;
    selectedDate: Date;
    dailyScores: Map<string, DailyScore>;
    weekPriorities: Map<string, Priority[]>;
    weekTodos: Map<string, Todo[]>;
    weekHabits: Map<string, number>;
    onDateSelect: (date: Date) => void;
    onWeekChange: (direction: 'prev' | 'next') => void;
}) {
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const getWeekDays = (): Date[] => {
        const start = getWeekStart(currentWeek);
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">Calendar Overview</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => onWeekChange('prev')}
                        className="rounded-md border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800 active:bg-slate-700 transition-colors min-h-[44px] min-w-[60px]"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => onWeekChange('next')}
                        className="rounded-md border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800 active:bg-slate-700 transition-colors min-h-[44px] min-w-[60px]"
                    >
                        Next →
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {weekDays.map((day) => {
                    const dateStr = formatDate(day);
                    const score = dailyScores.get(dateStr);
                    const dayPriorities = weekPriorities.get(dateStr) || [];
                    const dayTodos = weekTodos.get(dateStr) || [];
                    const dayHabitsCount = weekHabits.get(dateStr) || 0;
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    const hasData = dayHabitsCount > 0 || dayPriorities.length > 0 || dayTodos.length > 0 || score;

                    return (
                        <button
                            key={dateStr}
                            onClick={() => onDateSelect(day)}
                            className={`rounded-lg border p-2 sm:p-2.5 text-left transition-colors min-h-[60px] sm:min-h-[80px] ${
                                isSelected
                                    ? 'border-amber-500 bg-amber-950/30'
                                    : 'border-slate-700 hover:border-slate-600 active:bg-slate-800'
                            } ${isToday ? 'ring-2 ring-amber-400' : ''}`}
                        >
                            <div className="text-xs font-medium mb-1 text-slate-400">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className="text-base font-bold mb-1">{day.getDate()}</div>
                            <div className="space-y-1 min-h-[2.5rem]">
                                {/* Grade Badge - Show separately when score exists */}
                                {score && (
                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                        {score.grade}
                                    </div>
                                )}
                                {/* H/P/T Counters - Compact format "H3 P2 T1" */}
                                {(dayHabitsCount > 0 || dayPriorities.length > 0 || dayTodos.length > 0) && (
                                    <div className="flex flex-wrap gap-0.5 text-[9px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                                        {dayHabitsCount > 0 && (
                                            <span className="text-blue-600 dark:text-blue-400 font-semibold">H{dayHabitsCount}</span>
                                        )}
                                        {dayPriorities.length > 0 && (
                                            <span className="text-purple-600 dark:text-purple-400 font-semibold">P{dayPriorities.length}</span>
                                        )}
                                        {dayTodos.length > 0 && (
                                            <span className="text-green-600 dark:text-green-400 font-semibold">T{dayTodos.length}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

// Daily Plan Section Component
function DailyPlanSection({
    date,
    habitTemplates,
    habitEntries,
    priorities,
    todos,
    dailyContent,
    goals,
    scoringSettings,
    onDataChange,
}: {
    date: Date;
    habitTemplates: HabitTemplate[];
    habitEntries: HabitEntry[];
    priorities: Priority[];
    todos: Todo[];
    dailyContent: DailyContent | null;
    goals: Goal[];
    scoringSettings: { habits_weight: number; priorities_weight: number; todos_weight: number };
    onDataChange: () => void;
}) {
    const [showScoringModal, setShowScoringModal] = useState(false);
    const [scoringFormData, setScoringFormData] = useState({
        habits_weight: scoringSettings.habits_weight,
        priorities_weight: scoringSettings.priorities_weight,
        todos_weight: scoringSettings.todos_weight,
    });
    const [newPriority, setNewPriority] = useState('');
    const [newPriorityGoalId, setNewPriorityGoalId] = useState<string | null>(null);
    const [newTodo, setNewTodo] = useState('');
    const [newTodoGoalId, setNewTodoGoalId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState<DailyContent>({
        lessons: dailyContent?.lessons || '',
        ideas: dailyContent?.ideas || '',
        notes: dailyContent?.notes || '',
        distractions: dailyContent?.distractions || '',
        reflection: dailyContent?.reflection || '',
        news_updates: dailyContent?.news_updates || '',
    });
    const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(new Set());

    const dateStr = formatDate(date);
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
    const habitsCompleted = habitsWithEntries.filter(h => h.status === 'checked').length;
    const habitsTotal = habitsWithEntries.length;
    const habitsScore = habitsTotal === 0 ? 0 : Math.round((habitsCompleted / habitsTotal) * scoringSettings.habits_weight);
    
    const prioritiesCompleted = priorities.filter(p => p.completed).length;
    const prioritiesTotal = priorities.length;
    const prioritiesScore = prioritiesTotal === 0 ? 0 : Math.round((prioritiesCompleted / prioritiesTotal) * scoringSettings.priorities_weight);
    
    const todosCompleted = todos.filter(t => t.is_done).length;
    const todosTotal = todos.length;
    const todosScore = todosTotal === 0 ? 0 : Math.round((todosCompleted / todosTotal) * scoringSettings.todos_weight);

    // Overall score is the sum of weighted scores (0-100)
    const overallScore = habitsScore + prioritiesScore + todosScore;
    const grade = getGrade(overallScore);

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
                    completed: false,
                    goal_id: newPriorityGoalId,
                });

            setNewPriority('');
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
                    is_done: false,
                    goal_id: newTodoGoalId,
                });

            setNewTodo('');
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
                    score_physical: 0,
                    score_mental: 0,
                    score_spiritual: 0,
                    score_morning: 0,
                    score_afternoon: 0,
                    score_evening: 0,
                });
        } catch (error) {
            console.error('Error saving score:', error);
        }
    };

    return (
        <section className="space-y-4 sm:space-y-6">
            {/* Header - Stack on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">
                    Daily Plan - {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <div className="flex items-center gap-3">
                    <div className="text-right relative group">
                        <div className="text-2xl sm:text-3xl font-bold text-amber-400">{overallScore}</div>
                        <div className="text-base sm:text-lg font-semibold text-amber-300">Grade: {grade}</div>
                        <span className="absolute top-0 right-0 text-amber-400 cursor-help" title="Total Score = Habits Score + Priorities Score + Todos Score (0-100)">ℹ️</span>
                        <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-slate-800 text-xs text-slate-200 p-3 rounded shadow-lg z-10 max-w-xs">
                            <div className="font-semibold mb-2">Scoring Formula:</div>
                            <div className="mb-1">Each category: (completed / total) × weight</div>
                            <div className="mb-1">Total Score = Habits + Priorities + Todos</div>
                            <div className="text-slate-400 mt-2">Example: 1/4 habits × 40% = 10 points</div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setScoringFormData({
                                habits_weight: scoringSettings.habits_weight,
                                priorities_weight: scoringSettings.priorities_weight,
                                todos_weight: scoringSettings.todos_weight,
                            });
                            setShowScoringModal(true);
                        }}
                        className="text-slate-400 hover:text-amber-400 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Edit scoring weights"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {/* Score Breakdown - Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 rounded-lg border border-slate-700 bg-slate-900 p-3 sm:p-4">
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Habits ({scoringSettings.habits_weight}%)</div>
                    <div className="text-2xl font-bold text-blue-400">{habitsScore}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Priorities ({scoringSettings.priorities_weight}%)</div>
                    <div className="text-2xl font-bold text-purple-400">{prioritiesScore}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Todos ({scoringSettings.todos_weight}%)</div>
                    <div className="text-2xl font-bold text-green-400">{todosScore}</div>
                </div>
            </div>

            {/* Habits */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 sm:p-4 space-y-2">
                <h3 className="text-base font-semibold mb-3 text-blue-400">Habits</h3>
                {(['physical', 'mental', 'spiritual'] as Category[]).map(category => {
                    const categoryHabits = habitsWithEntries.filter(h => h.category === category);
                    if (categoryHabits.length === 0) return null;
                    
                    const completed = categoryHabits.filter(h => h.status === 'checked').length;
                    const total = categoryHabits.length;
                    const isExpanded = expandedCategories.has(category);
                    
                    const categoryColors = {
                        physical: 'text-blue-400 border-blue-500/30 bg-blue-950/20',
                        mental: 'text-purple-400 border-purple-500/30 bg-purple-950/20',
                        spiritual: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
                    };
                    
                    return (
                        <div key={category} className={`rounded-lg border ${categoryColors[category]} overflow-hidden`}>
                            <button
                                onClick={() => {
                                    const newExpanded = new Set(expandedCategories);
                                    if (isExpanded) {
                                        newExpanded.delete(category);
                                    } else {
                                        newExpanded.add(category);
                                    }
                                    setExpandedCategories(newExpanded);
                                }}
                                className="w-full flex items-center justify-between p-4 min-h-[48px] hover:opacity-80 transition-opacity"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold capitalize">{category}</span>
                                    <span className="text-xs text-slate-400">{completed}/{total} completed</span>
                                </div>
                                <span className="text-base">{isExpanded ? '▼' : '▶'}</span>
                            </button>
                            {isExpanded && (
                                <div className="border-t border-slate-700/50 p-3 space-y-3 bg-slate-900/50">
                                    {categoryHabits.map((habit) => {
                                        const linkedGoal = goals.find(g => g.id === habit.goal_id);
                                        return (
                                            <label key={habit.id} className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                                                <input
                                                    type="checkbox"
                                                    checked={habit.status === 'checked'}
                                                    onChange={() => handleHabitToggle(habit.id, habit.status)}
                                                    className="h-6 w-6 sm:h-5 sm:w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                                                />
                                                <span className="text-lg mr-2">{habit.icon}</span>
                                                <div className="flex-1 flex items-center gap-2">
                                                    <span className="text-white">{habit.name}</span>
                                                    {linkedGoal && (
                                                        <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {habitsWithEntries.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No habits for today. Add habits in the Habits tab.</p>
                )}
            </div>

            {/* Priorities (Max 5) */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 sm:p-4 space-y-2">
                <h3 className="text-base font-semibold mb-3 text-purple-400">Priorities (Max 5)</h3>
                {priorities.map((priority) => {
                    const linkedGoal = goals.find(g => g.id === priority.goal_id);
                    return (
                        <label key={priority.id} className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                            <input
                                type="checkbox"
                                checked={priority.completed}
                                onChange={() => handleTogglePriority(priority.id, priority.completed)}
                                className="h-6 w-6 sm:h-5 sm:w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                            />
                            <span className="flex-1 text-white">{priority.text}</span>
                            {linkedGoal && (
                                <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                            )}
                        </label>
                    );
                })}
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <input
                        type="text"
                        placeholder="Add priority"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && priorities.length < 5 && handleAddPriority()}
                        disabled={priorities.length >= 5}
                        className={`flex-1 rounded-md border border-slate-700 px-3 py-3 text-sm placeholder-slate-400 focus:outline-none min-h-[48px] ${
                            priorities.length >= 5
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-800 text-white focus:border-amber-500'
                        }`}
                    />
                    <select
                        value={newPriorityGoalId || ''}
                        onChange={(e) => setNewPriorityGoalId(e.target.value || null)}
                        disabled={priorities.length >= 5}
                        className={`rounded-md border border-slate-700 px-3 py-3 text-sm focus:outline-none min-h-[48px] sm:min-w-[140px] ${
                            priorities.length >= 5
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-800 text-white focus:border-amber-500'
                        }`}
                    >
                        <option value="">Link to goal (optional)</option>
                        {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddPriority}
                        disabled={priorities.length >= 5}
                        className={`rounded-md px-4 py-3 text-sm font-medium transition-colors min-h-[48px] ${
                            priorities.length >= 5
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600'
                        }`}
                    >
                        Add
                    </button>
                </div>
                {priorities.length >= 5 && (
                    <p className="text-xs text-slate-400 mt-2">Maximum of 5 priorities per day allowed</p>
                )}
            </div>

            {/* To-Do List */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 sm:p-4 space-y-2">
                <h3 className="text-base font-semibold mb-3 text-green-400">To-Do List</h3>
                {todos.map((todo) => {
                    const linkedGoal = goals.find(g => g.id === todo.goal_id);
                    return (
                        <label key={todo.id} className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                            <input
                                type="checkbox"
                                checked={todo.is_done}
                                onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                                className="h-6 w-6 sm:h-5 sm:w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                            />
                            <span className="flex-1 text-white">{todo.title}</span>
                            {linkedGoal && (
                                <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                            )}
                        </label>
                    );
                })}
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <input
                        type="text"
                        placeholder="Add todo"
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none min-h-[48px]"
                    />
                    <select
                        value={newTodoGoalId || ''}
                        onChange={(e) => setNewTodoGoalId(e.target.value || null)}
                        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white focus:border-amber-500 focus:outline-none min-h-[48px] sm:min-w-[140px]"
                    >
                        <option value="">Link to goal (optional)</option>
                        {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddTodo}
                        className="rounded-md bg-amber-500 px-4 py-3 text-sm font-medium text-black hover:bg-amber-400 active:bg-amber-600 transition-colors min-h-[48px]"
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* Daily Content Fields */}
            <div className="space-y-4">
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="text-base font-semibold mb-2 text-amber-400">Notes</h3>
                    <textarea
                        value={editingContent.notes || ''}
                        onChange={(e) => setEditingContent({ ...editingContent, notes: e.target.value })}
                        onBlur={handleSaveContent}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                        rows={3}
                        placeholder="Free text notes..."
                    />
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="font-semibold mb-2">Lessons</h3>
                    <textarea
                        value={editingContent.lessons || ''}
                        onChange={(e) => setEditingContent({ ...editingContent, lessons: e.target.value })}
                        onBlur={handleSaveContent}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                        rows={3}
                        placeholder="Lessons learned today..."
                    />
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="text-base font-semibold mb-2 text-cyan-400">News Updates</h3>
                    <textarea
                        value={editingContent.news_updates || ''}
                        onChange={(e) => setEditingContent({ ...editingContent, news_updates: e.target.value })}
                        onBlur={handleSaveContent}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                        rows={3}
                        placeholder="News updates or short bullets..."
                    />
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="text-base font-semibold mb-2 text-orange-400">Reflection</h3>
                    <textarea
                        value={editingContent.reflection || ''}
                        onChange={(e) => setEditingContent({ ...editingContent, reflection: e.target.value })}
                        onBlur={handleSaveContent}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                        rows={4}
                        placeholder="Daily reflection..."
                    />
                </div>
            </div>

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
                                        onDataChange();
                                        // Reload the page to refresh scoring settings
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 100);
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
        </section>
    );
}

// Goal Detail Modal Component
function GoalDetailModal({
    goalId,
    goals,
    onClose,
    onRefresh,
}: {
    goalId: string;
    goals: Goal[];
    onClose: () => void;
    onRefresh: () => void;
}) {
    const goal = goals.find(g => g.id === goalId);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [linkedHabits, setLinkedHabits] = useState<HabitTemplate[]>([]);
    const [linkedPriorities, setLinkedPriorities] = useState<Priority[]>([]);
    const [linkedTodos, setLinkedTodos] = useState<Todo[]>([]);

    useEffect(() => {
        if (goal) {
            loadGoalDetails();
        }
    }, [goal]);

    const loadGoalDetails = async () => {
        if (!goal) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load milestones
            const { data: milestonesData } = await supabase
                .from('habit_milestones')
                .select('*')
                .eq('user_id', user.id)
                .eq('goal_id', goal.id);

            // Load linked habits
            const { data: habitsData } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('goal_id', goal.id)
                .eq('is_active', true);

            // Load recent linked priorities and todos (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);
            
            const { data: prioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('*')
                .eq('user_id', user.id)
                .eq('goal_id', goal.id)
                .gte('date', thirtyDaysAgoStr)
                .order('date', { ascending: false })
                .limit(20);

            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('*')
                .eq('user_id', user.id)
                .eq('goal_id', goal.id)
                .gte('date', thirtyDaysAgoStr)
                .order('date', { ascending: false })
                .limit(20);

            setMilestones(milestonesData || []);
            setLinkedHabits(habitsData || []);
            setLinkedPriorities(prioritiesData || []);
            setLinkedTodos(todosData || []);
        } catch (error) {
            console.error('Error loading goal details:', error);
        }
    };

    if (!goal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white mb-2">{goal.name}</h2>
                        {goal.description && (
                            <p className="text-slate-300 mb-4">{goal.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            {goal.category && <span className="capitalize">{goal.category}</span>}
                            <span>Priority: {goal.priority_score}</span>
                            {goal.deadline && (
                                <span>Deadline: {new Date(goal.deadline).toLocaleDateString()}</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 transition-colors"
                    >
                        Close
                    </button>
                </div>

                {/* Milestones */}
                <div>
                    <h3 className="font-semibold mb-3">Milestones</h3>
                    {milestones.length === 0 ? (
                        <p className="text-sm text-slate-400">No milestones yet</p>
                    ) : (
                        <div className="space-y-2">
                            {milestones.map((milestone) => (
                                <div key={milestone.id} className="rounded-md border border-slate-700 bg-slate-800 p-3">
                                    <div className="font-medium text-white">{milestone.name}</div>
                                    <div className="text-sm text-slate-400">
                                        Current: {milestone.current_value} / {JSON.parse(milestone.values).join(', ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Linked Habits */}
                <div>
                    <h3 className="font-semibold mb-3">Linked Habits</h3>
                    {linkedHabits.length === 0 ? (
                        <p className="text-sm text-slate-400">No habits linked to this goal</p>
                    ) : (
                        <div className="space-y-2">
                            {linkedHabits.map((habit) => (
                                <div key={habit.id} className="flex items-center gap-2 text-sm text-white">
                                    <span>{habit.icon}</span>
                                    <span>{habit.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Linked Priorities */}
                <div>
                    <h3 className="font-semibold mb-3">Recent Priorities</h3>
                    {linkedPriorities.length === 0 ? (
                        <p className="text-sm text-slate-400">No priorities linked to this goal</p>
                    ) : (
                        <div className="space-y-2">
                            {linkedPriorities.map((priority) => (
                                <div key={priority.id} className="text-sm text-white">
                                    {priority.text} <span className="text-slate-400">({priority.date})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Linked Todos */}
                <div>
                    <h3 className="font-semibold mb-3">Recent Todos</h3>
                    {linkedTodos.length === 0 ? (
                        <p className="text-sm text-slate-400">No todos linked to this goal</p>
                    ) : (
                        <div className="space-y-2">
                            {linkedTodos.map((todo) => (
                                <div key={todo.id} className="text-sm text-white">
                                    {todo.title} <span className="text-slate-400">({todo.date})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

