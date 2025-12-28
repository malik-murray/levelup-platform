'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate, isSameDay } from '@/lib/habitHelpers';

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
};

type WeeklyItemDay = {
    id: string;
    weekly_item_id: string;
    date: string;
    completed: boolean;
    completed_at: string | null;
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
    const [goals, setGoals] = useState<Goal[]>([]);
    
    // Form states
    const [focusIntention, setFocusIntention] = useState('');
    const [notes, setNotes] = useState('');
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemGoalId, setNewItemGoalId] = useState<string | null>(null);
    const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
    const [newItemPriority, setNewItemPriority] = useState<'low' | 'med' | 'high'>('med');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Partial<WeeklyItem>>({});
    
    // Create new goal/category states
    const [showNewGoalInput, setShowNewGoalInput] = useState(false);
    const [newGoalName, setNewGoalName] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // Custom categories (stored in state, could be persisted later)
    const [customCategories, setCustomCategories] = useState<string[]>([]);

    // Get current week start (Sunday)
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const currentWeekStart = getWeekStart(new Date());
    const weekStartStr = formatDate(currentWeekStart);

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

                // Load item days
                if (itemsData && itemsData.length > 0) {
                    const itemIds = itemsData.map(item => item.id);
                    const { data: daysData } = await supabase
                        .from('habit_weekly_item_days')
                        .select('*')
                        .in('weekly_item_id', itemIds);

                    setItemDays(daysData || []);

                    // Sync todos: ensure todos exist for all assigned items
                    if (daysData && daysData.length > 0) {
                        for (const itemDay of daysData) {
                            const item = itemsData.find(i => i.id === itemDay.weekly_item_id);
                            if (item) {
                                // Check if todo exists
                                const { data: existingTodo } = await supabase
                                    .from('habit_daily_todos')
                                    .select('id')
                                    .eq('user_id', user.id)
                                    .eq('date', itemDay.date)
                                    .eq('title', item.title)
                                    .maybeSingle();

                                // Create todo if it doesn't exist
                                if (!existingTodo) {
                                    await supabase
                                        .from('habit_daily_todos')
                                        .insert({
                                            user_id: user.id,
                                            date: itemDay.date,
                                            title: item.title,
                                            category: item.category,
                                            time_of_day: null,
                                            is_done: itemDay.completed,
                                            completed_at: itemDay.completed_at,
                                            goal_id: item.goal_id,
                                        });
                                } else if (existingTodo && itemDay.completed !== undefined) {
                                    // Sync completion status if todo exists
                                    await supabase
                                        .from('habit_daily_todos')
                                        .update({
                                            is_done: itemDay.completed,
                                            completed_at: itemDay.completed_at,
                                        })
                                        .eq('id', existingTodo.id);
                                }
                            }
                        }
                    }
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
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding item:', error);
                alert(`Error adding item: ${error.message}`);
                return;
            }

            if (newItem) {
                setWeeklyItems([...weeklyItems, newItem]);
                setNewItemTitle('');
                setNewItemGoalId(null);
                setNewItemCategory(null);
                setNewItemPriority('med');
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
            await supabase
                .from('habit_weekly_items')
                .delete()
                .eq('id', itemId);

            // Also delete associated item days
            await supabase
                .from('habit_weekly_item_days')
                .delete()
                .eq('weekly_item_id', itemId);

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
                // Remove assignment
                await supabase
                    .from('habit_weekly_item_days')
                    .delete()
                    .eq('id', existingDay.id);

                setItemDays(prev => prev.filter(d => d.id !== existingDay.id));

                // Delete the corresponding todo if it exists
                await supabase
                    .from('habit_daily_todos')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('date', dateStr)
                    .eq('title', item.title);
            } else {
                // Add assignment
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
                    setItemDays([...itemDays, newDay]);

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
                        };

                        const { data: newTodo, error: todoError } = await supabase
                            .from('habit_daily_todos')
                            .insert(todoData)
                            .select()
                            .single();

                        if (todoError) {
                            console.error('Error creating todo:', JSON.stringify(todoError, null, 2));
                            console.error('Todo data attempted:', JSON.stringify(todoData, null, 2));
                            console.error('Item data:', JSON.stringify(item, null, 2));
                            console.error('User ID:', user.id);
                            console.error('Date string:', dateStr);
                        } else if (newTodo) {
                            console.log('Successfully created todo:', newTodo);
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

            // Update corresponding todo in daily plan
            const itemDay = itemDays.find(d => d.id === itemDayId);
            if (itemDay) {
                const item = weeklyItems.find(i => i.id === itemDay.weekly_item_id);
                if (item) {
                    // Update or create the todo
                    const { data: existingTodo } = await supabase
                        .from('habit_daily_todos')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('date', itemDay.date)
                        .eq('title', item.title)
                        .maybeSingle();

                    if (existingTodo) {
                        // Update existing todo
                        await supabase
                            .from('habit_daily_todos')
                            .update({
                                is_done: completed,
                                completed_at: completedAt,
                            })
                            .eq('id', existingTodo.id);
                    } else {
                        // Create todo if it doesn't exist (shouldn't happen, but just in case)
                        await supabase
                            .from('habit_daily_todos')
                            .insert({
                                user_id: user.id,
                                date: itemDay.date,
                                title: item.title,
                                category: item.category,
                                time_of_day: null,
                                is_done: completed,
                                completed_at: completedAt,
                                goal_id: item.goal_id,
                            });
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done':
                return 'bg-green-500/20 text-green-400';
            case 'in_progress':
                return 'bg-blue-500/20 text-blue-400';
            case 'not_started':
                return 'bg-slate-500/20 text-slate-400';
            default:
                return 'bg-slate-500/20 text-slate-400';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading...</div>;
    }

    const weekRange = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Weekly Plan</h1>
                    <p className="text-sm text-slate-400 mt-1">{weekRange}</p>
                </div>
            </div>

            {/* This Week's Focus */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h2 className="text-lg font-semibold mb-3">This Week's Focus</h2>
                <div className="space-y-3">
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
            </section>

            {/* What I want to accomplish this week */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h2 className="text-lg font-semibold mb-3">What I want to accomplish this week</h2>
                
                {/* Add new item */}
                <div className="mb-4 p-3 rounded border border-slate-700 bg-slate-900/50 space-y-2">
                    <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                        placeholder="Add a weekly goal/task..."
                        className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                    />
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
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-200">{item.title}</span>
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
                                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                    {item.status.replace('_', ' ')}
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
                    {weeklyItems.length === 0 && (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            No items yet. Add one above to get started.
                        </div>
                    )}
                </div>
            </section>

            {/* Break it into days */}
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h2 className="text-lg font-semibold mb-3">Break it into days</h2>
                
                {/* Mobile: Stacked layout, Desktop: Columns */}
                <div className="space-y-4 md:grid md:grid-cols-7 md:gap-3 md:space-y-0">
                    {weekDays.map((day) => {
                        const dateStr = formatDate(day);
                        const isToday = isSameDay(day, new Date());
                        const dayItems = itemDays.filter(d => d.date === dateStr);
                        const assignedItemIds = dayItems.map(d => d.weekly_item_id);
                        const unassignedItems = weeklyItems.filter(item => !assignedItemIds.includes(item.id));

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
                                {weeklyItems.length > 0 && (
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
                                            {weeklyItems.map(item => {
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
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

