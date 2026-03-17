'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate, isSameDay } from '@/lib/habitHelpers';
import WeeklyScoreBars, { type WeeklyScores } from './WeeklyScoreBars';

type WeeklyPlan = {
    id: string;
    week_start_date: string;
    focus_intention: string | null;
    notes: string | null;
};

type WeeklyItem = {
    id: string;
    weekly_plan_id: string;
    title: string;
    goal_id: string | null;
    category: string | null;
    priority: 'low' | 'med' | 'high';
    status: 'not_started' | 'in_progress' | 'done';
    sort_order: number;
    item_type?: 'goal' | 'todo';
};

type WeeklyItemDay = {
    id: string;
    weekly_item_id: string;
    date: string;
    completed: boolean;
    completed_at: string | null;
    todo_id?: string | null;
};

type WeeklyEvent = {
    id: string;
    title: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    sms_notify: boolean;
    todo_id?: string | null;
    is_done?: boolean;
};

type Goal = {
    id: string;
    name: string;
};

export default function WeeklyPlanView() {
    const [loading, setLoading] = useState(true);
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
    const [weeklyItems, setWeeklyItems] = useState<WeeklyItem[]>([]);
    const [itemDays, setItemDays] = useState<WeeklyItemDay[]>([]);
    const [events, setEvents] = useState<WeeklyEvent[]>([]);
    const [weeklyScores, setWeeklyScores] = useState<WeeklyScores | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    
    // Form states
    const [focusIntention, setFocusIntention] = useState('');
    const [notes, setNotes] = useState('');
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemGoalId, setNewItemGoalId] = useState<string | null>(null);
    const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
    const [newItemPriority, setNewItemPriority] = useState<'low' | 'med' | 'high'>('med');
    const [newItemType, setNewItemType] = useState<'goal' | 'todo'>('goal');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Partial<WeeklyItem>>({});
    
    // Create new goal/category states
    const [showNewGoalInput, setShowNewGoalInput] = useState(false);
    const [newGoalName, setNewGoalName] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // Events form
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventStartTime, setNewEventStartTime] = useState('');
    const [newEventEndTime, setNewEventEndTime] = useState('');
    
    // Custom categories (stored in state, could be persisted later)
    const [customCategories, setCustomCategories] = useState<string[]>([]);

    // Selected week (Sunday)
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };
    const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
    const currentWeekStart = selectedWeekStart;
    const weekStartStr = formatDate(currentWeekStart);

    const handlePrevWeek = () => {
        const prev = new Date(selectedWeekStart);
        prev.setDate(prev.getDate() - 7);
        setSelectedWeekStart(prev);
    };
    const handleNextWeek = () => {
        const next = new Date(selectedWeekStart);
        next.setDate(next.getDate() + 7);
        setSelectedWeekStart(next);
    };
    const handleThisWeek = () => {
        setSelectedWeekStart(getWeekStart(new Date()));
    };

    // Get the 7 days of the week
    const getWeekDays = (): Date[] => {
        const days: Date[] = [];
        const start = new Date(currentWeekStart);
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();

    useEffect(() => {
        loadData();
    }, [weekStartStr]);

    useEffect(() => {
        setNewEventDate(weekStartStr);
    }, [weekStartStr]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load goals
            const { data: goalsData } = await supabase
                .from('habit_goals')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .eq('is_archived', false)
                .order('name');

            setGoals(goalsData || []);

            // Load weekly events by date range first (independent of plan so they always persist)
            const weekEndForEvents = new Date(selectedWeekStart);
            weekEndForEvents.setDate(weekEndForEvents.getDate() + 6);
            const weekEndStrForEvents = formatDate(weekEndForEvents);
            const { data: eventsRaw } = await supabase
                .from('habit_weekly_events')
                .select('id, title, date, start_time, end_time, sms_notify, todo_id')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStrForEvents)
                .order('date')
                .order('start_time');
            const eventIdsWithTodo = (eventsRaw || []).map((e) => (e as { todo_id?: string }).todo_id).filter(Boolean) as string[];
            let todoIsDoneMap: Record<string, boolean> = {};
            if (eventIdsWithTodo.length > 0) {
                const { data: todosData } = await supabase
                    .from('habit_daily_todos')
                    .select('id, is_done')
                    .in('id', eventIdsWithTodo);
                if (todosData) todoIsDoneMap = Object.fromEntries(todosData.map((t) => [t.id, !!t.is_done]));
            }
            const eventsData: WeeklyEvent[] = (eventsRaw || []).map((e: Record<string, unknown>) => {
                const todoId = e.todo_id as string | undefined;
                return {
                    id: e.id,
                    title: e.title,
                    date: e.date,
                    start_time: e.start_time,
                    end_time: e.end_time,
                    sms_notify: e.sms_notify,
                    todo_id: todoId ?? null,
                    is_done: todoId ? todoIsDoneMap[todoId] ?? false : false,
                } as WeeklyEvent;
            });
            setEvents(eventsData);

            // Load or create weekly plan
            let { data: planData, error: planLoadError } = await supabase
                .from('habit_weekly_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr)
                .maybeSingle();

            if (planLoadError && planLoadError.code !== 'PGRST116') {
                // PGRST116 is "not found" which is expected if no plan exists
                console.error('Error loading weekly plan:', planLoadError);
            }

            if (!planData) {
                // Create new weekly plan
                const { data: newPlan, error: planCreateError } = await supabase
                    .from('habit_weekly_plans')
                    .insert({
                        user_id: user.id,
                        week_start_date: weekStartStr,
                        focus_intention: null,
                        notes: null,
                    })
                    .select()
                    .single();
                
                if (planCreateError) {
                    console.error('Error creating weekly plan:', planCreateError);
                    throw planCreateError;
                }
                
                planData = newPlan;
            }

            if (planData) {
                setWeeklyPlan(planData);
                setFocusIntention(planData.focus_intention || '');
                setNotes(planData.notes || '');

                // Load weekly items
                const { data: itemsData } = await supabase
                    .from('habit_weekly_items')
                    .select('*')
                    .eq('weekly_plan_id', planData.id)
                    .order('sort_order');

                setWeeklyItems(itemsData || []);

                let daysData: WeeklyItemDay[] | null = null;
                // Load item days
                if (itemsData && itemsData.length > 0) {
                    const itemIds = itemsData.map(item => item.id);
                    const { data: daysResult } = await supabase
                        .from('habit_weekly_item_days')
                        .select('*')
                        .in('weekly_item_id', itemIds);
                    daysData = daysResult || [];

                    setItemDays(daysData);

                    // Sync todos: ensure todos exist for all assigned items (two-way linking)
                    const mapCategory = (c: string | null): 'physical' | 'mental' | 'spiritual' | null => {
                        if (!c) return null;
                        const m: Record<string, 'physical' | 'mental' | 'spiritual' | null> = {
                            health: 'physical', family: 'mental', relationships: 'mental', work: 'mental',
                            business: 'mental', education: 'mental', finance: 'mental', personal: 'mental', other: null,
                        };
                        return m[c.toLowerCase()] || null;
                    };
                    if (daysData.length > 0) {
                        for (const itemDay of daysData) {
                            const item = itemsData.find(i => i.id === itemDay.weekly_item_id);
                            if (!item) continue;
                            const { data: existingTodo } = await supabase
                                .from('habit_daily_todos')
                                .select('id')
                                .eq('user_id', user.id)
                                .eq('date', itemDay.date)
                                .eq('title', item.title)
                                .maybeSingle();

                            if (!existingTodo) {
                                const { data: newTodo } = await supabase
                                    .from('habit_daily_todos')
                                    .insert({
                                        user_id: user.id,
                                        date: itemDay.date,
                                        title: item.title,
                                        category: mapCategory(item.category),
                                        time_of_day: null,
                                        is_done: itemDay.completed,
                                        completed_at: itemDay.completed_at,
                                        goal_id: item.goal_id,
                                        weekly_item_day_id: itemDay.id,
                                    })
                                    .select('id')
                                    .single();
                                if (newTodo) {
                                    await supabase
                                        .from('habit_weekly_item_days')
                                        .update({ todo_id: newTodo.id })
                                        .eq('id', itemDay.id);
                                }
                            } else {
                                await supabase
                                    .from('habit_daily_todos')
                                    .update({
                                        is_done: itemDay.completed,
                                        completed_at: itemDay.completed_at,
                                        weekly_item_day_id: itemDay.id,
                                    })
                                    .eq('id', existingTodo.id);
                                const wid = (itemDay as { todo_id?: string }).todo_id;
                                if (!wid) {
                                    await supabase
                                        .from('habit_weekly_item_days')
                                        .update({ todo_id: existingTodo.id })
                                        .eq('id', itemDay.id);
                                }
                            }
                        }
                    }
                }

                // Compute weekly scores from habit_daily_scores (events already loaded above)
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekEndStr = formatDate(weekEnd);
                const { data: dailyScores } = await supabase
                    .from('habit_daily_scores')
                    .select('date, score_overall, score_habits, score_priorities, score_todos')
                    .eq('user_id', user.id)
                    .gte('date', weekStartStr)
                    .lte('date', weekEndStr);
                const todayStr = formatDate(new Date());
                const scoresUpToToday = (dailyScores || []).filter((d: { date: string }) => d.date <= todayStr);
                if (scoresUpToToday.length > 0) {
                    const avgOverall = Math.round(scoresUpToToday.reduce((s: number, d: { score_overall?: number }) => s + (d.score_overall || 0), 0) / scoresUpToToday.length);
                    const avgHabits = Math.round(scoresUpToToday.reduce((s: number, d: { score_habits?: number }) => s + (d.score_habits || 0), 0) / scoresUpToToday.length);
                    const avgPriorities = Math.round(scoresUpToToday.reduce((s: number, d: { score_priorities?: number }) => s + (d.score_priorities || 0), 0) / scoresUpToToday.length);
                    const avgTodos = Math.round(scoresUpToToday.reduce((s: number, d: { score_todos?: number }) => s + (d.score_todos || 0), 0) / scoresUpToToday.length);
                    const eventsUpToToday = eventsData.filter((e: WeeklyEvent) => e.date <= todayStr);
                    const eventsCompleted = eventsUpToToday.filter((e: WeeklyEvent) => e.is_done).length;
                    const eventsScore = eventsUpToToday.length > 0 ? Math.round((eventsCompleted / eventsUpToToday.length) * 100) : 0;
                    setWeeklyScores({
                        avg_daily_score: avgOverall,
                        weekly_habits_score: avgHabits,
                        weekly_todos_score: avgTodos,
                        weekly_events_score: eventsScore,
                        // Avg Daily is already a composite; keep weights simple and ensure non-future days only.
                        score_overall: Math.round((avgOverall * 0.4 + avgHabits * 0.25 + avgTodos * 0.25 + eventsScore * 0.1)),
                    });
                } else {
                    setWeeklyScores(null);
                }
            }
        } catch (error) {
            console.error('Error loading weekly plan:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveFocus = async () => {
        if (!weeklyPlan) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_weekly_plans')
                .update({
                    focus_intention: focusIntention || null,
                    notes: notes || null,
                })
                .eq('id', weeklyPlan.id);
        } catch (error) {
            console.error('Error saving focus:', error);
        }
    };

    const handleCreateGoal = async () => {
        if (!newGoalName.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: newGoal } = await supabase
                .from('habit_goals')
                .insert({
                    user_id: user.id,
                    name: newGoalName.trim(),
                    is_completed: false,
                    is_archived: false,
                })
                .select('id, name')
                .single();

            if (newGoal) {
                setGoals([...goals, newGoal]);
                setNewItemGoalId(newGoal.id);
                setNewGoalName('');
                setShowNewGoalInput(false);
            }
        } catch (error) {
            console.error('Error creating goal:', error);
        }
    };

    const handleCreateCategory = () => {
        if (!newCategoryName.trim()) return;

        const category = newCategoryName.trim().toLowerCase();
        if (!customCategories.includes(category) && !['work', 'family', 'health', 'finance', 'personal', 'business', 'education', 'relationships', 'other'].includes(category)) {
            const updated = [...customCategories, category];
            setCustomCategories(updated);
            localStorage.setItem('weekly_plan_custom_categories', JSON.stringify(updated));
            setNewItemCategory(category);
            setNewCategoryName('');
            setShowNewCategoryInput(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItemTitle.trim()) {
            alert('Please enter a title for the item');
            return;
        }

        if (!weeklyPlan) {
            alert('Weekly plan not loaded. Please refresh the page.');
            console.error('Weekly plan is null');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('You must be logged in to add items');
                return;
            }

            const { data: newItem, error } = await supabase
                .from('habit_weekly_items')
                .insert({
                    user_id: user.id,
                    weekly_plan_id: weeklyPlan.id,
                    title: newItemTitle.trim(),
                    goal_id: newItemGoalId,
                    category: newItemCategory,
                    priority: newItemPriority,
                    status: 'not_started',
                    sort_order: weeklyItems.length,
                    item_type: newItemType,
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding item:', error);
                alert(`Error adding item: ${error.message}`);
                return;
            }

            if (newItem) {
                setWeeklyItems([...weeklyItems, { ...newItem, item_type: newItemType }]);
                setNewItemTitle('');
                setNewItemGoalId(null);
                setNewItemCategory(null);
                setNewItemPriority('med');
                setNewItemType('goal');
                setShowNewGoalInput(false);
                setShowNewCategoryInput(false);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert(`Error adding item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleUpdateItem = async (itemId: string, updates: Partial<WeeklyItem>) => {
        try {
            await supabase
                .from('habit_weekly_items')
                .update(updates)
                .eq('id', itemId);

            setWeeklyItems(prev => prev.map(item => 
                item.id === itemId ? { ...item, ...updates } : item
            ));
        } catch (error) {
            console.error('Error updating item:', error);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Delete this item?')) return;

        try {
            const daysToRemove = itemDays.filter(d => d.weekly_item_id === itemId);
            for (const d of daysToRemove) {
                const todoId = (d as WeeklyItemDay).todo_id;
                if (todoId) {
                    await supabase.from('habit_daily_todos').delete().eq('id', todoId);
                }
            }
            await supabase
                .from('habit_weekly_item_days')
                .delete()
                .eq('weekly_item_id', itemId);
            await supabase
                .from('habit_weekly_items')
                .delete()
                .eq('id', itemId);

            setWeeklyItems(prev => prev.filter(item => item.id !== itemId));
            setItemDays(prev => prev.filter(day => day.weekly_item_id !== itemId));
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleToggleDayAssignment = async (itemId: string, date: Date) => {
        const dateStr = formatDate(date);
        const existingDay = itemDays.find(d => d.weekly_item_id === itemId && d.date === dateStr);
        const item = weeklyItems.find(i => i.id === itemId);

        if (!item) {
            console.error('Item not found for id:', itemId);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (existingDay) {
                // Remove assignment - delete linked todo first (by todo_id or title+date)
                const todoId = (existingDay as WeeklyItemDay).todo_id;
                if (todoId) {
                    await supabase.from('habit_daily_todos').delete().eq('id', todoId);
                } else {
                    await supabase
                        .from('habit_daily_todos')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('date', dateStr)
                        .eq('title', item.title);
                }
                await supabase
                    .from('habit_weekly_item_days')
                    .delete()
                    .eq('id', existingDay.id);

                setItemDays(prev => prev.filter(d => d.id !== existingDay.id));
            } else {
                // Before adding assignment, remove any existing assignments for this item to other days
                const otherDayAssignments = itemDays.filter(d => d.weekly_item_id === itemId && d.date !== dateStr);
                
                if (otherDayAssignments.length > 0) {
                    // Delete all other assignments
                    for (const otherDay of otherDayAssignments) {
                        const oTodoId = (otherDay as WeeklyItemDay).todo_id;
                        if (oTodoId) {
                            await supabase.from('habit_daily_todos').delete().eq('id', oTodoId);
                        } else {
                            await supabase
                                .from('habit_daily_todos')
                                .delete()
                                .eq('user_id', user.id)
                                .eq('date', otherDay.date)
                                .eq('title', item.title);
                        }
                        await supabase
                            .from('habit_weekly_item_days')
                            .delete()
                            .eq('id', otherDay.id);
                    }

                    // Update local state to remove other assignments
                    setItemDays(prev => prev.filter(d => !(d.weekly_item_id === itemId && d.date !== dateStr)));
                }

                // Add assignment to the new day
                const { data: newDay, error: dayError } = await supabase
                    .from('habit_weekly_item_days')
                    .insert({
                        weekly_item_id: itemId,
                        date: dateStr,
                        completed: false,
                    })
                    .select()
                    .single();

                if (dayError) {
                    console.error('Error creating weekly item day:', dayError);
                    return;
                }

                if (newDay) {
                    setItemDays(prev => [...prev.filter(d => !(d.weekly_item_id === itemId && d.date !== dateStr)), newDay]);

                    // Verify item exists before creating todo
                    if (!item) {
                        console.error('Item not found when trying to create todo for itemId:', itemId);
                        return;
                    }

                    // Create corresponding todo in daily plan (check if it doesn't already exist)
                    const { data: existingTodo, error: checkError } = await supabase
                        .from('habit_daily_todos')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('date', dateStr)
                        .eq('title', item.title)
                        .maybeSingle();

                    if (checkError) {
                        console.error('Error checking for existing todo:', checkError);
                        return;
                    }

                    if (!existingTodo) {
                        // Ensure all required fields are present
                        if (!item.title || item.title.trim() === '') {
                            console.error('Cannot create todo: item title is empty', item);
                            return;
                        }

                        // Map weekly plan categories to todo categories
                        // Weekly plan: work, family, health, finance, personal, business, education, relationships, other
                        // Todo categories: physical, mental, spiritual
                        const mapCategory = (weeklyCategory: string | null): 'physical' | 'mental' | 'spiritual' | null => {
                            if (!weeklyCategory) return null;
                            const categoryMap: Record<string, 'physical' | 'mental' | 'spiritual' | null> = {
                                'health': 'physical',
                                'family': 'mental', // relationships/emotional = mental
                                'relationships': 'mental',
                                'work': 'mental',
                                'business': 'mental',
                                'education': 'mental',
                                'finance': 'mental',
                                'personal': 'mental',
                                'other': null, // No clear mapping, set to null
                            };
                            return categoryMap[weeklyCategory.toLowerCase()] || null;
                        };

                        const todoData = {
                            user_id: user.id,
                            date: dateStr,
                            title: item.title.trim(),
                            category: mapCategory(item.category),
                            time_of_day: null,
                            is_done: false,
                            goal_id: item.goal_id || null,
                            weekly_item_day_id: newDay.id,
                        };

                        const { data: newTodo, error: todoError } = await supabase
                            .from('habit_daily_todos')
                            .insert(todoData)
                            .select()
                            .single();

                        if (!todoError && newTodo) {
                            await supabase
                                .from('habit_weekly_item_days')
                                .update({ todo_id: newTodo.id })
                                .eq('id', newDay.id);
                        } else if (todoError) {
                            console.error('Error creating todo:', todoError);
                        }
                    } else {
                        console.log('Todo already exists for this item and date');
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling day assignment:', error);
        }
    };

    const handleToggleDayCompletion = async (itemDayId: string, completed: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const completedAt = completed ? new Date().toISOString() : null;

            await supabase
                .from('habit_weekly_item_days')
                .update({
                    completed,
                    completed_at: completedAt,
                })
                .eq('id', itemDayId);

            setItemDays(prev => prev.map(day =>
                day.id === itemDayId ? { ...day, completed, completed_at: completedAt } : day
            ));

            // Update corresponding todo in daily plan (two-way sync)
            const itemDay = itemDays.find(d => d.id === itemDayId);
            if (itemDay) {
                const item = weeklyItems.find(i => i.id === itemDay.weekly_item_id);
                if (item) {
                    const todoId = (itemDay as WeeklyItemDay).todo_id;
                    if (todoId) {
                        await supabase
                            .from('habit_daily_todos')
                            .update({ is_done: completed, completed_at: completedAt })
                            .eq('id', todoId);
                    } else {
                        const { data: existingTodo } = await supabase
                            .from('habit_daily_todos')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('date', itemDay.date)
                            .eq('title', item.title)
                            .maybeSingle();

                        if (existingTodo) {
                            await supabase
                                .from('habit_daily_todos')
                                .update({ is_done: completed, completed_at: completedAt })
                                .eq('id', existingTodo.id);
                            await supabase
                                .from('habit_weekly_item_days')
                                .update({ todo_id: existingTodo.id })
                                .eq('id', itemDayId);
                        } else {
                            const mapCat = (c: string | null): 'physical' | 'mental' | 'spiritual' | null => {
                                if (!c) return null;
                                const m: Record<string, 'physical' | 'mental' | 'spiritual' | null> = {
                                    health: 'physical', family: 'mental', relationships: 'mental', work: 'mental',
                                    business: 'mental', education: 'mental', finance: 'mental', personal: 'mental', other: null,
                                };
                                return m[c.toLowerCase()] || null;
                            };
                            await supabase
                                .from('habit_daily_todos')
                                .insert({
                                    user_id: user.id,
                                    date: itemDay.date,
                                    title: item.title,
                                    category: mapCat(item.category),
                                    time_of_day: null,
                                    is_done: completed,
                                    completed_at: completedAt,
                                    goal_id: item.goal_id,
                                    weekly_item_day_id: itemDayId,
                                });
                        }
                    }

                    // Update item status based on day completions
                    const allDays = itemDays.filter(d => d.weekly_item_id === item.id);
                    const allCompleted = allDays.length > 0 && allDays.every(d => d.completed);
                    const anyInProgress = allDays.some(d => d.completed);

                    if (allCompleted) {
                        handleUpdateItem(item.id, { status: 'done' });
                    } else if (anyInProgress) {
                        handleUpdateItem(item.id, { status: 'in_progress' });
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling day completion:', error);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'med':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'low':
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
            default:
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const formatEventTimeShort = (start: string | null, end: string | null): string => {
        const fmt = (t: string) => {
            const [h, m] = t.slice(0, 5).split(':').map(Number);
            const hour = h % 12 || 12;
            const ampm = h < 12 ? 'am' : 'pm';
            return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`;
        };
        if (start && end) return `${fmt(start)}-${fmt(end)}`;
        if (start) return fmt(start);
        return '';
    };

    const handleAddEvent = async () => {
        if (!newEventTitle.trim() || !weeklyPlan) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const eventDate = newEventDate || weekStartStr;
            const { data: newEvent, error } = await supabase
                .from('habit_weekly_events')
                .insert({
                    user_id: user.id,
                    weekly_plan_id: weeklyPlan.id,
                    title: newEventTitle.trim(),
                    date: eventDate,
                    start_time: newEventStartTime || null,
                    end_time: newEventEndTime || null,
                    sms_notify: false,
                })
                .select()
                .single();
            if (!error && newEvent) {
                setNewEventTitle('');
                setNewEventStartTime('');
                setNewEventEndTime('');
                const timeLabel = formatEventTimeShort(newEvent.start_time, newEvent.end_time);
                const todoTitle = timeLabel ? `(${timeLabel}) ${newEvent.title}` : newEvent.title;
                // Create todo on that day for two-way sync (title includes time for daily list)
                const { data: newTodo } = await supabase
                    .from('habit_daily_todos')
                    .insert({
                        user_id: user.id,
                        date: eventDate,
                        title: todoTitle,
                        is_done: false,
                        weekly_event_id: newEvent.id,
                    })
                    .select('id')
                    .single();
                if (newTodo) {
                    await supabase
                        .from('habit_weekly_events')
                        .update({ todo_id: newTodo.id })
                        .eq('id', newEvent.id);
                }
                const addedEvent = { ...newEvent, todo_id: newTodo?.id ?? null, is_done: false };
                setEvents(prev => {
                    const next = [...prev, addedEvent];
                    setWeeklyScores(s => {
                        if (!s) return s;
                        const todayStr = formatDate(new Date());
                        const eligible = next.filter(e => e.date <= todayStr);
                        const eventsScore = eligible.length > 0 ? Math.round((eligible.filter(e => e.is_done).length / eligible.length) * 100) : 0;
                        return {
                            ...s,
                            weekly_events_score: eventsScore,
                            score_overall: Math.round(s.avg_daily_score * 0.4 + s.weekly_habits_score * 0.25 + s.weekly_todos_score * 0.25 + eventsScore * 0.1),
                        };
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Error adding event:', error);
        }
    };

    const handleToggleEventCompletion = async (ev: WeeklyEvent, completed: boolean) => {
        if (!ev.todo_id) return;
        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: completed, completed_at: completed ? new Date().toISOString() : null })
                .eq('id', ev.todo_id);
            const nextEvents = events.map(e => e.id === ev.id ? { ...e, is_done: completed } : e);
            setEvents(nextEvents);
            setWeeklyScores(prev => {
                if (!prev) return prev;
                const todayStr = formatDate(new Date());
                const eligible = nextEvents.filter(e => e.date <= todayStr);
                const completedCount = eligible.filter(e => e.is_done).length;
                const eventsScore = eligible.length > 0 ? Math.round((completedCount / eligible.length) * 100) : 0;
                return {
                    ...prev,
                    weekly_events_score: eventsScore,
                    score_overall: Math.round(prev.avg_daily_score * 0.4 + prev.weekly_habits_score * 0.25 + prev.weekly_todos_score * 0.25 + eventsScore * 0.1),
                };
            });
        } catch (err) {
            console.error('Error toggling event completion:', err);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Delete this event?')) return;
        try {
            const ev = events.find(e => e.id === eventId);
            const { data } = await supabase.from('habit_weekly_events').select('todo_id').eq('id', eventId).single();
            if (data?.todo_id) {
                await supabase.from('habit_daily_todos').delete().eq('id', data.todo_id);
            }
            await supabase.from('habit_weekly_events').delete().eq('id', eventId);
            setEvents(prev => {
                const next = prev.filter(e => e.id !== eventId);
                setWeeklyScores(s => {
                    if (!s) return s;
                    const todayStr = formatDate(new Date());
                    const eligible = next.filter(e => e.date <= todayStr);
                    const eventsScore = eligible.length > 0 ? Math.round((eligible.filter(e => e.is_done).length / eligible.length) * 100) : 0;
                    return {
                        ...s,
                        weekly_events_score: eventsScore,
                        score_overall: Math.round(s.avg_daily_score * 0.4 + s.weekly_habits_score * 0.25 + s.weekly_todos_score * 0.25 + eventsScore * 0.1),
                    };
                });
                return next;
            });
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    // Calendar sync placeholder - would need Google Calendar API etc.
    // TODO: Add calendar integration when API is available

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading...</div>;
    }

    const weekRange = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const goalsItems = weeklyItems.filter(i => (i.item_type || 'goal') === 'goal');
    const todosItems = weeklyItems.filter(i => i.item_type === 'todo');

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
                    <button
                        onClick={handlePrevWeek}
                        className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 transition-colors shrink-0 justify-self-start"
                        aria-label="Previous week"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex flex-col items-center justify-center min-w-0">
                        <span className="text-sm font-medium text-slate-300">
                            {weekRange}
                        </span>
                        <button
                            onClick={handleThisWeek}
                            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                            This Week
                        </button>
                    </div>
                    <button
                        onClick={handleNextWeek}
                        className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 transition-colors shrink-0 justify-self-end"
                        aria-label="Next week"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Weekly Score */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <details open className="group">
                    <summary className="text-lg font-semibold mb-3 cursor-pointer list-none flex items-center justify-between">
                        <span>Weekly Score</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3">
                        <WeeklyScoreBars scores={weeklyScores} />
                    </div>
                </details>
            </section>

            {/* This Week's Focus */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <details open className="group">
                    <summary className="text-lg font-semibold mb-3 cursor-pointer list-none flex items-center justify-between">
                        <span>This Week's Focus</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="space-y-3 mt-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Weekly Intention / Theme</label>
                        <textarea
                            value={focusIntention}
                            onChange={(e) => setFocusIntention(e.target.value)}
                            onBlur={saveFocus}
                            placeholder="What's your focus this week? (one sentence)"
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm resize-none"
                            rows={2}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={saveFocus}
                            placeholder="Additional notes..."
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm resize-none"
                            rows={3}
                        />
                    </div>
                    </div>
                </details>
            </section>

            {/* Weekly Goals & To-Do */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <details open className="group">
                    <summary className="text-lg font-semibold mb-3 cursor-pointer list-none flex items-center justify-between">
                        <span>Weekly Goals & To-Do</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3">
                        {/* Add new item */}
                        <div className="mb-4 p-3 rounded border border-slate-700 bg-slate-900/50 space-y-2">
                            <div className="flex gap-2">
                                <select
                                    value={newItemType}
                                    onChange={(e) => setNewItemType(e.target.value as 'goal' | 'todo')}
                                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs shrink-0"
                                >
                                    <option value="goal">Goal / Priority</option>
                                    <option value="todo">To-Do</option>
                                </select>
                                <input
                                    type="text"
                                    value={newItemTitle}
                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                    placeholder={newItemType === 'goal' ? 'Add a weekly goal...' : 'Add a weekly to-do...'}
                                    className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                        <div className="flex-1 min-w-[120px] relative">
                            <select
                                value={newItemGoalId || ''}
                                onChange={(e) => {
                                    if (e.target.value === '__create_new__') {
                                        setShowNewGoalInput(true);
                                        setNewItemGoalId(null);
                                    } else {
                                        setNewItemGoalId(e.target.value || null);
                                    }
                                }}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            >
                                <option value="">No Goal</option>
                                {goals.map(goal => (
                                    <option key={goal.id} value={goal.id}>{goal.name}</option>
                                ))}
                                <option value="__create_new__">+ Create New Goal</option>
                            </select>
                            {showNewGoalInput && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newGoalName}
                                        onChange={(e) => setNewGoalName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCreateGoal();
                                            } else if (e.key === 'Escape') {
                                                setShowNewGoalInput(false);
                                                setNewGoalName('');
                                            }
                                        }}
                                        placeholder="Goal name..."
                                        className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateGoal}
                                        className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400"
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewGoalInput(false);
                                            setNewGoalName('');
                                        }}
                                        className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-[100px] relative">
                            <select
                                value={newItemCategory || ''}
                                onChange={(e) => {
                                    if (e.target.value === '__create_new__') {
                                        setShowNewCategoryInput(true);
                                        setNewItemCategory(null);
                                    } else {
                                        setNewItemCategory(e.target.value || null);
                                    }
                                }}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            >
                                <option value="">No Category</option>
                                <option value="work">Work</option>
                                <option value="family">Family</option>
                                <option value="health">Health</option>
                                <option value="finance">Finance</option>
                                <option value="personal">Personal</option>
                                <option value="business">Business</option>
                                <option value="education">Education</option>
                                <option value="relationships">Relationships</option>
                                <option value="other">Other</option>
                                {customCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                ))}
                                <option value="__create_new__">+ Create New Category</option>
                            </select>
                            {showNewCategoryInput && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCreateCategory();
                                            } else if (e.key === 'Escape') {
                                                setShowNewCategoryInput(false);
                                                setNewCategoryName('');
                                            }
                                        }}
                                        placeholder="Category name..."
                                        className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateCategory}
                                        className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400"
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewCategoryInput(false);
                                            setNewCategoryName('');
                                        }}
                                        className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        <select
                            value={newItemPriority}
                            onChange={(e) => setNewItemPriority(e.target.value as 'low' | 'med' | 'high')}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs flex-1 min-w-[80px]"
                        >
                            <option value="low">Low</option>
                            <option value="med">Med</option>
                            <option value="high">High</option>
                        </select>
                        <button
                            onClick={handleAddItem}
                            className="px-4 py-1.5 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition-colors min-h-[36px]"
                        >
                            Add
                        </button>
                    </div>
                </div>

                        {/* Weekly items list */}
                        <div className="space-y-2">
                    {weeklyItems.map(item => {
                        const linkedGoal = goals.find(g => g.id === item.goal_id);
                        const isEditing = editingItemId === item.id;

                        return (
                            <div
                                key={item.id}
                                className="p-3 rounded border border-slate-700 bg-slate-900/50"
                            >
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={editingItem.title || item.title}
                                            onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                                            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 flex-wrap">
                                            <div className="flex-1 min-w-[120px]">
                                                <select
                                                    value={editingItem.goal_id || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__create_new__') {
                                                            setShowNewGoalInput(true);
                                                            setEditingItem({ ...editingItem, goal_id: null });
                                                        } else {
                                                            setEditingItem({ ...editingItem, goal_id: e.target.value || null });
                                                        }
                                                    }}
                                                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                                >
                                                    <option value="">No Goal</option>
                                                    {goals.map(goal => (
                                                        <option key={goal.id} value={goal.id}>{goal.name}</option>
                                                    ))}
                                                    <option value="__create_new__">+ Create New Goal</option>
                                                </select>
                                                {showNewGoalInput && editingItemId && (
                                                    <div className="mt-2 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newGoalName}
                                                            onChange={(e) => setNewGoalName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleCreateGoal();
                                                                } else if (e.key === 'Escape') {
                                                                    setShowNewGoalInput(false);
                                                                    setNewGoalName('');
                                                                }
                                                            }}
                                                            placeholder="Goal name..."
                                                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={handleCreateGoal}
                                                            className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowNewGoalInput(false);
                                                                setNewGoalName('');
                                                            }}
                                                            className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-[100px]">
                                                <select
                                                    value={editingItem.category || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__create_new__') {
                                                            setShowNewCategoryInput(true);
                                                            setEditingItem({ ...editingItem, category: null });
                                                        } else {
                                                            setEditingItem({ ...editingItem, category: e.target.value || null });
                                                        }
                                                    }}
                                                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                                >
                                                    <option value="">No Category</option>
                                                    <option value="work">Work</option>
                                                    <option value="family">Family</option>
                                                    <option value="health">Health</option>
                                                    <option value="finance">Finance</option>
                                                    <option value="personal">Personal</option>
                                                    <option value="business">Business</option>
                                                    <option value="education">Education</option>
                                                    <option value="relationships">Relationships</option>
                                                    <option value="other">Other</option>
                                                    {customCategories.map(cat => (
                                                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                                    ))}
                                                    <option value="__create_new__">+ Create New Category</option>
                                                </select>
                                                {showNewCategoryInput && editingItemId && (
                                                    <div className="mt-2 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleCreateCategory();
                                                                } else if (e.key === 'Escape') {
                                                                    setShowNewCategoryInput(false);
                                                                    setNewCategoryName('');
                                                                }
                                                            }}
                                                            placeholder="Category name..."
                                                            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={handleCreateCategory}
                                                            className="px-3 py-1.5 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowNewCategoryInput(false);
                                                                setNewCategoryName('');
                                                            }}
                                                            className="px-3 py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <select
                                                value={editingItem.priority || item.priority}
                                                onChange={(e) => setEditingItem({ ...editingItem, priority: e.target.value as 'low' | 'med' | 'high' })}
                                                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                            >
                                                <option value="low">Low</option>
                                                <option value="med">Med</option>
                                                <option value="high">High</option>
                                            </select>
                                            <select
                                                value={editingItem.status || item.status}
                                                onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as 'not_started' | 'in_progress' | 'done' })}
                                                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                                            >
                                                <option value="not_started">Not Started</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="done">Done</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    if (editingItem.title) {
                                                        handleUpdateItem(item.id, editingItem);
                                                    }
                                                    setEditingItemId(null);
                                                    setEditingItem({});
                                                }}
                                                className="px-3 py-1 rounded bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingItemId(null);
                                                    setEditingItem({});
                                                }}
                                                className="px-3 py-1 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <label className="flex items-center cursor-pointer shrink-0 pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={item.status === 'done'}
                                                onChange={(e) => handleUpdateItem(item.id, { status: e.target.checked ? 'done' : 'not_started' })}
                                                className="h-5 w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                            />
                                        </label>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`font-medium ${item.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{item.title}</span>
                                                {linkedGoal && (
                                                    <span className="text-xs text-slate-400">→ {linkedGoal.name}</span>
                                                )}
                                                {item.category && (
                                                    <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(item.priority)}`}>
                                                        {item.category}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(item.priority)}`}>
                                                    {item.priority}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingItemId(item.id);
                                                    setEditingItem({ title: item.title, goal_id: item.goal_id, category: item.category, priority: item.priority, status: item.status });
                                                }}
                                                className="px-2 py-1 rounded border border-slate-700 text-slate-400 text-xs hover:bg-slate-800"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="px-2 py-1 rounded border border-slate-700 text-red-400 text-xs hover:bg-slate-800"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                        {(goalsItems.length === 0 && todosItems.length === 0) && (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                No items yet. Add a goal or to-do above to get started.
                            </div>
                        )}
                        </div>
                    </div>
                </details>
            </section>

            {/* Weekly Events */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <details open className="group">
                    <summary className="text-lg font-semibold mb-3 cursor-pointer list-none flex items-center justify-between">
                        <span>Weekly Events / Meetings / Appointments</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2 items-end p-3 rounded border border-slate-700 bg-slate-900/50">
                            <input
                                type="text"
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                placeholder="Event title..."
                                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm flex-1 min-w-[140px]"
                            />
                            <select
                                value={newEventDate}
                                onChange={(e) => setNewEventDate(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            >
                                {weekDays.map(d => (
                                    <option key={formatDate(d)} value={formatDate(d)}>
                                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="time"
                                value={newEventStartTime}
                                onChange={(e) => setNewEventStartTime(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            />
                            <input
                                type="time"
                                value={newEventEndTime}
                                onChange={(e) => setNewEventEndTime(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            />
                            <button
                                onClick={handleAddEvent}
                                className="px-4 py-2 rounded bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                            >
                                Add Event
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {events.map(ev => (
                                <li key={ev.id} className="flex items-center gap-3 p-3 rounded border border-slate-700 bg-slate-900/50 min-h-[44px]">
                                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={!!ev.is_done}
                                            onChange={(e) => handleToggleEventCompletion(ev, e.target.checked)}
                                            disabled={!ev.todo_id}
                                            className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-medium block ${ev.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                                {ev.title}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                {ev.start_time && ` • ${ev.start_time.slice(0, 5)}`}
                                            </span>
                                        </div>
                                    </label>
                                    <button
                                        onClick={() => handleDeleteEvent(ev.id)}
                                        className="text-red-400 hover:text-red-300 text-sm shrink-0"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {events.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-2">No events scheduled.</p>
                        )}
                        <p className="text-xs text-slate-500">
                            Calendar sync: placeholder for future Google Calendar integration.
                        </p>
                    </div>
                </details>
            </section>

            {/* Break it into days */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <details open className="group">
                    <summary className="text-lg font-semibold mb-3 cursor-pointer list-none flex items-center justify-between">
                        <span>Break it into days</span>
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3">
                        {/* Mobile: Stacked layout, Desktop: Columns */}
                <div className="space-y-4 md:grid md:grid-cols-7 md:gap-3 md:space-y-0">
                    {weekDays.map((day) => {
                        const dateStr = formatDate(day);
                        const isToday = isSameDay(day, new Date());
                        const dayItems = itemDays.filter(d => d.date === dateStr);
                        const assignedItemIds = dayItems.map(d => d.weekly_item_id);

                        return (
                            <div
                                key={dateStr}
                                className={`rounded-lg border p-3 ${
                                    isToday
                                        ? 'border-amber-500 bg-amber-950/20'
                                        : 'border-slate-700 bg-slate-900/50'
                                }`}
                            >
                                <div className="font-semibold text-sm mb-2">
                                    <div className="text-xs text-slate-400">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div className="text-slate-200">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                    {isToday && <div className="text-xs text-amber-400 mt-1">Today</div>}
                                </div>

                                {/* Assigned items for this day */}
                                <div className="space-y-2 mb-3">
                                    {dayItems.map(itemDay => {
                                        const item = weeklyItems.find(i => i.id === itemDay.weekly_item_id);
                                        if (!item) return null;

                                        return (
                                            <div key={itemDay.id} className="flex items-center gap-2 p-2 rounded bg-slate-800/50 group">
                                                <input
                                                    type="checkbox"
                                                    checked={itemDay.completed}
                                                    onChange={(e) => handleToggleDayCompletion(itemDay.id, e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                                                />
                                                <span className={`text-xs flex-1 ${itemDay.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                                    {item.title}
                                                </span>
                                                <button
                                                    onClick={() => handleToggleDayAssignment(item.id, day)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 flex-shrink-0"
                                                    title="Remove from this day"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Assign items to this day */}
                                {weeklyItems.length > 0 && (() => {
                                    // Get all item IDs that are assigned to OTHER days (not this day)
                                    const assignedToOtherDays = new Set(
                                        itemDays
                                            .filter(d => d.date !== dateStr)
                                            .map(d => d.weekly_item_id)
                                    );
                                    
                                    // Filter to only show items that are either:
                                    // 1. Assigned to this day (so they can be unassigned), OR
                                    // 2. Not assigned to any day
                                    const availableItems = weeklyItems.filter(item => 
                                        assignedItemIds.includes(item.id) || !assignedToOtherDays.has(item.id)
                                    );
                                    
                                    return availableItems.length > 0 ? (
                                        <details className="group">
                                            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 list-none">
                                                <span className="flex items-center gap-1">
                                                    {dayItems.length > 0 ? 'Reassign items' : '+ Assign item'}
                                                    <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </span>
                                            </summary>
                                            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                                {availableItems.map(item => {
                                                    const isAssigned = assignedItemIds.includes(item.id);
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleToggleDayAssignment(item.id, day)}
                                                            className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                                                isAssigned
                                                                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            {isAssigned ? '✓ ' : '+ '}{item.title}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </details>
                                    ) : null;
                                })()}
                            </div>
                        );
                    })}
                        </div>
                    </div>
                </details>
            </section>
        </div>
    );
}

