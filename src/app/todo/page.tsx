'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';
import { formatDate } from '@/lib/habitHelpers';
import { compareByQuadrant, getQuadrant, QUADRANT_META, quadrantBadgeClasses, type EisenhowerQuadrant } from '@/lib/habit/eisenhower';
import { EisenhowerToggles, QuadrantBadge } from '@/components/habit/EisenhowerToggles';
import {
  assignBacklogTodoToDate,
  deleteBacklogTask,
  deleteBacklogTodo,
  repairOrphanedBacklogTasks,
  setBacklogTaskCategories,
  setTodoCategories,
  syncBacklogCompletion,
  syncBacklogEisenhower,
  syncBacklogTitle,
  updateBacklogTaskGoal,
  updateTodoEisenhower,
  updateTodoGoal,
} from '@/lib/habitBacklog';
import { TodoDeleteButton } from '@/components/TodoDeleteButton';
import { GoalPicker } from '@/components/goals/GoalPicker';
import { useGoalsForPicker } from '@/lib/goals/useGoalsForPicker';
import {
  loadBacklogCategories,
  loadBacklogTaskCategoryIdsByTaskId,
  loadTodoCategoryIdsByTodoId,
  type BacklogCategory,
} from '@/lib/habit/backlogCategories';
import { BacklogCategoryPicker } from '@/components/habit/BacklogCategoryPicker';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

type TodoItem = {
  id: string;
  title: string;
  is_done: boolean;
  date: string | null;
  created_at: string | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
  backlog_task_id: string | null;
  daily_todo_id: string | null;
  category_ids: string[];
  goal_id: string | null;
};

const isBacklogOnly = (todo: TodoItem) => todo.daily_todo_id === null;

type DoneCategory = 'habit' | 'priority' | 'to-do';

type DoneDateFilter = '' | 'all' | 'today' | 'this-week' | 'this-month';
type DoneSort = '' | 'newest' | 'oldest';

type DoneItem = {
  id: string;
  title: string;
  category: DoneCategory;
  date: string;
  completed_at: string | null;
};

const normalizeTodoTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

const dedupeOpenTodos = (rows: TodoItem[]): TodoItem[] => {
  const byBacklogTaskId = new Map<string, TodoItem>();
  const withoutBacklog: TodoItem[] = [];

  rows.forEach((todo) => {
    if (!todo.backlog_task_id) {
      withoutBacklog.push(todo);
      return;
    }

    const existing = byBacklogTaskId.get(todo.backlog_task_id);
    if (!existing) {
      byBacklogTaskId.set(todo.backlog_task_id, todo);
      return;
    }

    const existingCreated = existing.created_at ?? '';
    const nextCreated = todo.created_at ?? '';
    if (nextCreated.localeCompare(existingCreated) > 0) {
      byBacklogTaskId.set(todo.backlog_task_id, todo);
    }
  });

  return [...withoutBacklog, ...byBacklogTaskId.values()];
};

const sortTodoItems = (items: TodoItem[]) =>
  [...items].sort((a, b) =>
    compareByQuadrant(a, b, (x, y) => {
      const xDate = x.date ?? '';
      const yDate = y.date ?? '';
      if (xDate !== yDate) {
        if (!xDate) return -1;
        if (!yDate) return 1;
        return yDate.localeCompare(xDate);
      }
      return (y.created_at ?? '').localeCompare(x.created_at ?? '');
    })
  );

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getDoneItemDateString = (item: DoneItem) => item.completed_at?.slice(0, 10) ?? item.date;

const getDoneItemTimeMs = (item: DoneItem) => {
  const timestamp = item.completed_at ?? `${item.date}T00:00:00`;
  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? 0 : value;
};

const formatDoneItemTimestamp = (item: DoneItem) => {
  const value = new Date(item.completed_at ?? `${item.date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return item.date;
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

type GroupFilter = '' | 'all' | 'uncategorized' | string;

export default function TodoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [doneItems, setDoneItems] = useState<DoneItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignOpenById, setAssignOpenById] = useState<Record<string, boolean>>({});
  const [assignDateById, setAssignDateById] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
  const [doneCategoryFilter, setDoneCategoryFilter] = useState<'' | 'all' | DoneCategory>('');
  const [doneDateFilter, setDoneDateFilter] = useState<DoneDateFilter>('');
  const [doneSort, setDoneSort] = useState<DoneSort>('');
  const [quadrantFilter, setQuadrantFilter] = useState<'' | 'all' | EisenhowerQuadrant>('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('');
  const [categories, setCategories] = useState<BacklogCategory[]>([]);
  const [newTodoCategoryIds, setNewTodoCategoryIds] = useState<string[]>([]);
  const [newTodoGoalId, setNewTodoGoalId] = useState<string | null>(null);
  const goals = useGoalsForPicker(userId);

  const todayString = useMemo(() => formatDate(new Date()), []);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          window.location.href = '/login';
          return;
        }
        setUserId(user.id);
      } catch (err) {
        console.error('Error checking auth for to-do page:', err);
        window.location.href = '/login';
      }
    };

    checkAuthAndLoad();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadData(userId);
  }, [userId]);

  const loadData = async (activeUserId: string) => {
    try {
      const [categoriesResult, todosResult, backlogResult] = await Promise.all([
        loadBacklogCategories(supabase, activeUserId),
        supabase
          .from('habit_daily_todos')
          .select('id, title, is_done, date, created_at, is_important, is_urgent, backlog_task_id, goal_id')
          .eq('user_id', activeUserId)
          .eq('is_done', false)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('habit_backlog_tasks')
          .select('id, title, assigned_date, created_at, is_important, is_urgent, goal_id')
          .eq('user_id', activeUserId)
          .is('completed_at', null)
          .or('daily_item_type.eq.todo,daily_item_type.is.null'),
      ]);

      setCategories(categoriesResult);

      if (todosResult.error) throw todosResult.error;
      if (backlogResult.error) throw backlogResult.error;

      let rows = todosResult.data ?? [];
      const backlogTasks = backlogResult.data ?? [];
      const linkedBacklogIds = new Set(
        rows.map((todo) => todo.backlog_task_id).filter((id): id is string => Boolean(id))
      );
      const assignedOrphanedBacklogTasks = backlogTasks.filter(
        (task) => task.assigned_date && !linkedBacklogIds.has(task.id)
      );

      if (assignedOrphanedBacklogTasks.length > 0) {
        await repairOrphanedBacklogTasks(supabase, activeUserId, assignedOrphanedBacklogTasks);

        const { data: repairedRows, error: repairedError } = await supabase
          .from('habit_daily_todos')
          .select('id, title, is_done, date, created_at, is_important, is_urgent, backlog_task_id, goal_id')
          .eq('user_id', activeUserId)
          .eq('is_done', false)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });
        if (repairedError) throw repairedError;
        rows = repairedRows ?? [];
      }

      const dedupedRows = dedupeOpenTodos(
        rows.map((todo) => ({
          ...todo,
          daily_todo_id: todo.id,
          backlog_task_id: todo.backlog_task_id,
          category_ids: [] as string[],
        }))
      );

      const linkedAfterRepair = new Set(
        dedupedRows.map((todo) => todo.backlog_task_id).filter((id): id is string => Boolean(id))
      );
      const unassignedBacklogTasks = backlogTasks.filter((task) => !linkedAfterRepair.has(task.id));

      const [categoryIdsByTodoId, categoryIdsByBacklogTaskId] = await Promise.all([
        loadTodoCategoryIdsByTodoId(
          supabase,
          activeUserId,
          dedupedRows.map((todo) => todo.daily_todo_id).filter((id): id is string => Boolean(id))
        ),
        loadBacklogTaskCategoryIdsByTaskId(
          supabase,
          activeUserId,
          unassignedBacklogTasks.map((task) => task.id)
        ),
      ]);

      const assignedItems: TodoItem[] = dedupedRows.map((todo) => ({
        id: todo.daily_todo_id ?? todo.id,
        daily_todo_id: todo.daily_todo_id,
        backlog_task_id: todo.backlog_task_id,
        title: todo.title,
        is_done: todo.is_done,
        date: todo.date,
        created_at: todo.created_at,
        is_important: todo.is_important,
        is_urgent: todo.is_urgent,
        category_ids: categoryIdsByTodoId[todo.daily_todo_id ?? ''] ?? [],
        goal_id: todo.goal_id ?? null,
      }));

      const unassignedItems: TodoItem[] = unassignedBacklogTasks.map((task) => ({
        id: task.id,
        daily_todo_id: null,
        backlog_task_id: task.id,
        title: task.title,
        is_done: false,
        date: null,
        created_at: task.created_at,
        is_important: task.is_important,
        is_urgent: task.is_urgent,
        category_ids: categoryIdsByBacklogTaskId[task.id] ?? [],
        goal_id: task.goal_id ?? null,
      }));

      const mergedTodos = sortTodoItems([...assignedItems, ...unassignedItems]);
      setTodos(mergedTodos);

      const nextAssignDates: Record<string, string> = {};
      mergedTodos.forEach((todo) => {
        nextAssignDates[todo.id] = todo.date ?? todayString;
      });
      setAssignDateById(nextAssignDates);

      const [{ data: completedTodos, error: completedTodosError }, { data: completedPriorities, error: completedPrioritiesError }, { data: completedHabits, error: completedHabitsError }] =
        await Promise.all([
          supabase
            .from('habit_daily_todos')
            .select('id, title, date, completed_at')
            .eq('user_id', activeUserId)
            .eq('is_done', true)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .order('date', { ascending: false }),
          supabase
            .from('habit_daily_priorities')
            .select('id, text, date, completed_at')
            .eq('user_id', activeUserId)
            .eq('completed', true)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .order('date', { ascending: false }),
          supabase
            .from('habit_daily_entries')
            .select('id, date, checked_at, habit_template:habit_templates(name)')
            .eq('user_id', activeUserId)
            .eq('status', 'checked')
            .order('checked_at', { ascending: false, nullsFirst: false })
            .order('date', { ascending: false }),
        ]);

      if (completedTodosError) throw completedTodosError;
      if (completedPrioritiesError) throw completedPrioritiesError;
      if (completedHabitsError) throw completedHabitsError;

      const mappedCompletedTodos: DoneItem[] = (completedTodos ?? []).map((item) => ({
        id: `todo-${item.id}`,
        title: item.title,
        category: 'to-do',
        date: item.date,
        completed_at: item.completed_at ?? null,
      }));

      const mappedCompletedPriorities: DoneItem[] = (completedPriorities ?? []).map((item) => ({
        id: `priority-${item.id}`,
        title: item.text,
        category: 'priority',
        date: item.date,
        completed_at: item.completed_at ?? null,
      }));

      const mappedCompletedHabits: DoneItem[] = (completedHabits ?? []).map((item) => {
        const ht = item.habit_template as { name: string } | { name: string }[] | null | undefined;
        const templateName =
          ht == null ? null : Array.isArray(ht) ? (ht[0]?.name ?? null) : ht.name;
        return {
          id: `habit-${item.id}`,
          title: templateName ?? 'Habit',
          category: 'habit' as const,
          date: item.date,
          completed_at: item.checked_at ?? null,
        };
      });

      const mergedDoneItems = [...mappedCompletedTodos, ...mappedCompletedPriorities, ...mappedCompletedHabits].sort(
        (a, b) => getDoneItemTimeMs(b) - getDoneItemTimeMs(a)
      );
      setDoneItems(mergedDoneItems);
    } catch (err) {
      console.error('Error loading to-do page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async () => {
    if (!userId) return;
    const trimmed = newTodoTitle.trim();
    if (!trimmed) return;

    const normalized = normalizeTodoTitle(trimmed);
    if (todos.some((todo) => normalizeTodoTitle(todo.title) === normalized)) {
      setNewTodoTitle('');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('habit_backlog_tasks')
        .insert({
          user_id: userId,
          title: trimmed,
          is_important: false,
          is_urgent: false,
          goal_id: newTodoGoalId,
        })
        .select('id, title, created_at, is_important, is_urgent, goal_id')
        .single();
      if (error) throw error;
      if (data) {
        if (newTodoCategoryIds.length > 0) {
          await setBacklogTaskCategories(userId, data.id, newTodoCategoryIds);
        }
        const item: TodoItem = {
          id: data.id,
          daily_todo_id: null,
          backlog_task_id: data.id,
          title: data.title,
          is_done: false,
          date: null,
          created_at: data.created_at,
          is_important: data.is_important,
          is_urgent: data.is_urgent,
          category_ids: [...newTodoCategoryIds],
          goal_id: data.goal_id ?? null,
        };
        setTodos((prev) => sortTodoItems([item, ...prev]));
        setAssignDateById((prev) => ({ ...prev, [data.id]: todayString }));
      }
      setNewTodoTitle('');
      setNewTodoCategoryIds([]);
      setNewTodoGoalId(null);
    } catch (err) {
      console.error('Error adding to-do:', err);
    }
  };

  const handleDeleteTodo = async (todo: TodoItem) => {
    if (!userId) return;

    const previousTodos = todos;
    setTodos((prev) => prev.filter((item) => item.id !== todo.id));
    setAssignOpenById((prev) => {
      const next = { ...prev };
      delete next[todo.id];
      return next;
    });
    setAssignDateById((prev) => {
      const next = { ...prev };
      delete next[todo.id];
      return next;
    });

    try {
      if (isBacklogOnly(todo) && todo.backlog_task_id) {
        await deleteBacklogTask(userId, todo.backlog_task_id);
      } else if (todo.daily_todo_id) {
        await deleteBacklogTodo(userId, todo.daily_todo_id, todo.backlog_task_id);
      }
    } catch (err) {
      console.error('Error deleting to-do:', err);
      setTodos(previousTodos);
    }
  };

  const handleToggleTodo = async (todo: TodoItem) => {
    if (!userId) return;
    const completedAt = new Date().toISOString();
    try {
      if (isBacklogOnly(todo) && todo.backlog_task_id) {
        await syncBacklogCompletion(todo.backlog_task_id, true);
      } else if (todo.daily_todo_id) {
        const { error } = await supabase
          .from('habit_daily_todos')
          .update({ is_done: true, completed_at: completedAt })
          .eq('id', todo.daily_todo_id)
          .eq('user_id', userId);
        if (error) throw error;
      }
      setTodos((prev) => prev.filter((item) => item.id !== todo.id));
      setDoneItems((prev) => [
        {
          id: `todo-${todo.daily_todo_id ?? todo.backlog_task_id}`,
          title: todo.title,
          category: 'to-do',
          date: todo.date ?? todayString,
          completed_at: completedAt,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error('Error marking to-do complete:', err);
    }
  };

  const handleTitleBlur = async (todoId: string, nextTitle: string) => {
    if (!userId) return;
    const trimmed = nextTitle.trim();

    if (!trimmed) {
      return;
    }

    const normalized = normalizeTodoTitle(trimmed);
    const duplicate = todos.find((todo) => todo.id !== todoId && normalizeTodoTitle(todo.title) === normalized);
    if (duplicate) {
      return;
    }

    const todo = todos.find((item) => item.id === todoId);
    if (!todo) return;

    try {
      if (isBacklogOnly(todo) && todo.backlog_task_id) {
        await syncBacklogTitle(todo.backlog_task_id, trimmed);
      } else if (todo.daily_todo_id) {
        const { error } = await supabase
          .from('habit_daily_todos')
          .update({ title: trimmed })
          .eq('id', todo.daily_todo_id)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error renaming to-do item:', err);
    }
  };

  const handleTodoEisenhowerChange = async (
    todoId: string,
    fields: { is_important: boolean | null; is_urgent: boolean | null }
  ) => {
    if (!userId) return;

    const previous = todos.find((item) => item.id === todoId);
    if (!previous) return;

    setTodos((prev) =>
      prev.map((item) => (item.id === todoId ? { ...item, ...fields } : item))
    );

    try {
      if (isBacklogOnly(previous) && previous.backlog_task_id) {
        await syncBacklogEisenhower(previous.backlog_task_id, fields);
      } else if (previous.daily_todo_id) {
        await updateTodoEisenhower(previous.daily_todo_id, userId, fields, previous.backlog_task_id);
      }
    } catch (err) {
      console.error('Error updating task classification:', err);
      setTodos((prev) =>
        prev.map((item) =>
          item.id === todoId
            ? {
                ...item,
                is_important: previous.is_important,
                is_urgent: previous.is_urgent,
              }
            : item
        )
      );
    }
  };

  const handleTodoGoalChange = async (todoId: string, goalId: string | null) => {
    if (!userId) return;

    const previous = todos.find((item) => item.id === todoId);
    if (!previous) return;

    setTodos((prev) =>
      prev.map((item) => (item.id === todoId ? { ...item, goal_id: goalId } : item))
    );

    try {
      if (isBacklogOnly(previous) && previous.backlog_task_id) {
        await updateBacklogTaskGoal(userId, previous.backlog_task_id, goalId);
      } else if (previous.daily_todo_id) {
        await updateTodoGoal(previous.daily_todo_id, userId, goalId);
      }
    } catch (err) {
      console.error('Error linking goal:', err);
      setTodos((prev) =>
        prev.map((item) => (item.id === todoId ? { ...item, goal_id: previous.goal_id } : item))
      );
    }
  };

  const handleTodoCategoriesChange = async (todoId: string, categoryIds: string[]) => {
    if (!userId) return;

    const previous = todos.find((item) => item.id === todoId);
    if (!previous) return;

    setTodos((prev) =>
      prev.map((item) => (item.id === todoId ? { ...item, category_ids: categoryIds } : item))
    );

    try {
      if (isBacklogOnly(previous) && previous.backlog_task_id) {
        await setBacklogTaskCategories(userId, previous.backlog_task_id, categoryIds);
      } else if (previous.daily_todo_id) {
        await setTodoCategories(previous.daily_todo_id, userId, categoryIds, previous.backlog_task_id);
      }
    } catch (err) {
      console.error('Error updating task tags:', err);
      setTodos((prev) =>
        prev.map((item) =>
          item.id === todoId ? { ...item, category_ids: previous.category_ids } : item
        )
      );
    }
  };

  const filteredTodos = useMemo(() => {
    let items = todos;

    if (quadrantFilter !== '' && quadrantFilter !== 'all') {
      items = items.filter(
        (todo) =>
          getQuadrant({ is_important: todo.is_important ?? null, is_urgent: todo.is_urgent ?? null }) ===
          quadrantFilter
      );
    }

    if (groupFilter !== '' && groupFilter !== 'all') {
      if (groupFilter === 'uncategorized') {
        items = items.filter((todo) => todo.category_ids.length === 0);
      } else {
        items = items.filter((todo) => todo.category_ids.includes(groupFilter));
      }
    }

    return items;
  }, [todos, quadrantFilter, groupFilter]);

  const quadrantCounts = useMemo(() => {
    const counts: Record<EisenhowerQuadrant, number> = {
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      unclassified: 0,
    };
    todos.forEach((todo) => {
      const q = getQuadrant({ is_important: todo.is_important ?? null, is_urgent: todo.is_urgent ?? null });
      counts[q] += 1;
    });
    return counts;
  }, [todos]);

  const filteredDoneItems = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    return doneItems
      .filter((item) => {
        if (doneCategoryFilter !== '' && doneCategoryFilter !== 'all' && item.category !== doneCategoryFilter) return false;
        if (doneDateFilter === '' || doneDateFilter === 'all') return true;

        const itemDate = new Date(`${getDoneItemDateString(item)}T00:00:00`);
        if (Number.isNaN(itemDate.getTime())) return false;

        if (doneDateFilter === 'today') return itemDate.getTime() === todayStart.getTime();
        if (doneDateFilter === 'this-week') return itemDate >= weekStart && itemDate <= todayStart;
        if (doneDateFilter === 'this-month') return itemDate >= monthStart && itemDate <= todayStart;
        return true;
      })
      .sort((a, b) => {
        const diff = getDoneItemTimeMs(a) - getDoneItemTimeMs(b);
        return doneSort === 'oldest' ? diff : -diff;
      });
  }, [doneItems, doneCategoryFilter, doneDateFilter, doneSort]);

  const handleAssignDate = async (todoId: string) => {
    if (!userId) return;
    const selectedDate = assignDateById[todoId];
    if (!selectedDate) return;

    const todo = todos.find((item) => item.id === todoId);
    if (!todo) return;

    try {
      if (isBacklogOnly(todo) && todo.backlog_task_id) {
        const created = await assignBacklogTodoToDate(
          userId,
          todo.backlog_task_id,
          todo.title,
          selectedDate,
          {
            is_important: todo.is_important ?? false,
            is_urgent: todo.is_urgent ?? false,
          },
          todo.category_ids,
          todo.goal_id
        );
        if (!created) return;

        const assigned: TodoItem = {
          id: created.id,
          daily_todo_id: created.id,
          backlog_task_id: created.backlog_task_id ?? todo.backlog_task_id,
          title: created.title,
          is_done: created.is_done,
          date: created.date,
          created_at: created.created_at,
          is_important: created.is_important,
          is_urgent: created.is_urgent,
          category_ids: todo.category_ids,
          goal_id: created.goal_id ?? todo.goal_id,
        };
        setTodos((prev) => prev.map((item) => (item.id === todoId ? assigned : item)));
        setAssignDateById((prev) => ({ ...prev, [assigned.id]: selectedDate }));
      } else if (todo.daily_todo_id) {
        const { error } = await supabase
          .from('habit_daily_todos')
          .update({ date: selectedDate })
          .eq('id', todo.daily_todo_id)
          .eq('user_id', userId);
        if (error) throw error;
        setTodos((prev) =>
          prev.map((item) => (item.id === todoId ? { ...item, date: selectedDate } : item))
        );
      }
      setAssignOpenById((prev) => ({ ...prev, [todoId]: false }));
    } catch (err) {
      console.error('Error assigning to-do date:', err);
    }
  };

  if (loading) {
    return (
      <main className={`${outfit.className} flex min-h-dvh items-center justify-center bg-white text-slate-900 transition-colors dark:bg-[#010205] dark:text-white`}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
          <p className="text-sm text-slate-400">Loading to-dos...</p>
        </div>
      </main>
    );
  }

  return (
    <div className={`${outfit.className} ${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden`}>
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-800/95 via-slate-900 to-slate-950/95 dark:hidden"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, #050816 0%, #010205 42%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -8%, rgba(255,120,40,0.2) 0%, transparent 55%)',
            }}
          />
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="min-w-0 px-4 pb-2 pt-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 lg:max-w-6xl">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>

              <div className="flex flex-1 justify-center">
                <div className="relative h-16 w-36 sm:h-[4.5rem] sm:w-44">
                  <Image
                    src={LOGO_SRC}
                    alt="Level Up Solutions"
                    fill
                    unoptimized
                    className="object-contain object-center"
                    sizes="176px"
                    priority
                  />
                </div>
              </div>

              <div className="h-11 w-11 shrink-0" aria-hidden />
            </div>

            <div className="mx-auto mt-5 w-full max-w-2xl lg:max-w-4xl">
              <h1
                className="text-center text-2xl font-extrabold tracking-tight text-[#ffe066] sm:text-3xl"
                style={{ textShadow: '0 0 16px rgba(255,157,0,0.35)' }}
              >
                Task Backlog
              </h1>
              <p className="mt-2 text-center text-sm text-slate-300">
                Triage with the Eisenhower matrix — mark Important and Urgent, then assign Q1/Q2 items to your daily plan.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('todo')}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    activeTab === 'todo'
                      ? 'border-[#ff9d00]/70 bg-[#ff9d00]/20 text-[#ffe066]'
                      : 'border-[#ff9d00]/35 bg-black/20 text-slate-300 hover:bg-[#ff9d00]/10'
                  }`}
                >
                  To Do
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('done')}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    activeTab === 'done'
                      ? 'border-[#ff9d00]/70 bg-[#ff9d00]/20 text-[#ffe066]'
                      : 'border-[#ff9d00]/35 bg-black/20 text-slate-300 hover:bg-[#ff9d00]/10'
                  }`}
                >
                  Done
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto pb-20">
            <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-4 lg:max-w-4xl">
              <section className={`${neon.panel} p-2.5`}>
                {activeTab === 'todo' ? (
                  <>
                    <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                        <div
                          key={q}
                          className={`rounded-md border px-2 py-2 text-center ${quadrantBadgeClasses(q)}`}
                          title={QUADRANT_META[q].description}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wide">
                            {QUADRANT_META[q].shortLabel}
                          </p>
                          <p className="mt-0.5 text-[9px] font-semibold leading-tight sm:text-[10px]">
                            {QUADRANT_META[q].label}
                          </p>
                          <p className="mt-1.5 text-lg font-bold tabular-nums text-white">{quadrantCounts[q]}</p>
                          <p className="mt-0.5 text-[8px] leading-tight text-slate-400 sm:text-[9px]">
                            {QUADRANT_META[q].description}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-1.5">
                      <select
                        value={groupFilter === '' ? 'all' : groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}
                        aria-label="Filter by tag"
                        className="w-full rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-2 py-1 text-[11px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                      >
                        <option value="all">All tags</option>
                        <option value="uncategorized">No tags</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={quadrantFilter === '' ? 'all' : quadrantFilter}
                        onChange={(e) =>
                          setQuadrantFilter(e.target.value as '' | 'all' | EisenhowerQuadrant)
                        }
                        aria-label="Filter by quadrant"
                        className="w-full rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-2 py-1 text-[11px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                      >
                        <option value="all">All quadrants</option>
                        {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                          <option key={q} value={q}>
                            {QUADRANT_META[q].shortLabel} — {QUADRANT_META[q].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-2 flex flex-wrap items-start gap-1.5">
                      <textarea
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleAddTodo();
                          }
                        }}
                        placeholder="Add something to your backlog..."
                        rows={1}
                        className="min-h-[1.8rem] min-w-0 flex-1 resize-none break-words overflow-y-auto rounded-md border border-[#ff9d00]/25 bg-[#03060f]/90 px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                      />
                      <BacklogCategoryPicker
                        compact
                        categories={categories}
                        selectedIds={newTodoCategoryIds}
                        onChange={setNewTodoCategoryIds}
                      />
                      <GoalPicker
                        compact
                        goals={goals}
                        value={newTodoGoalId}
                        onChange={setNewTodoGoalId}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddTodo()}
                        className="shrink-0 rounded-md border border-[#ff9d00]/55 bg-[#ff9d00]/10 px-2 py-1 text-[11px] font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/20"
                      >
                        Add
                      </button>
                    </div>

                    {filteredTodos.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[#ff9d00]/35 bg-black/20 px-4 py-6 text-center text-sm text-slate-300">
                        {todos.length === 0
                          ? 'Nothing pending right now. Add new items above to keep your task brain clear.'
                          : 'No tasks match the current filters.'}
                      </p>
                    ) : (
                      <ol className="space-y-1 min-w-0">
                        {filteredTodos.map((todo, index) => (
                          <li key={todo.id} className="space-y-1 rounded-md border border-[#ff9d00]/20 bg-[#03060f]/70 p-1.5">
                            <div className="flex min-w-0 items-start gap-1">
                              <span className="mt-1 shrink-0 text-[11px] font-semibold text-slate-300">{index + 1}.</span>
                              <input
                                type="checkbox"
                                checked={todo.is_done}
                                onChange={() => void handleToggleTodo(todo)}
                                className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-[#ff9d00]/50 text-[#ff9d00] focus:ring-[#ff9d00]/40"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <textarea
                                  value={todo.title}
                                  onChange={(e) => {
                                    const nextTitle = e.target.value;
                                    setTodos((prev) => prev.map((item) => (item.id === todo.id ? { ...item, title: nextTitle } : item)));
                                  }}
                                  onBlur={(e) => void handleTitleBlur(todo.id, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.target as HTMLTextAreaElement).blur()}
                                  rows={1}
                                  className="min-h-[1.8rem] w-full resize-none break-words overflow-y-auto rounded-md border border-[#ff9d00]/25 bg-[#03060f]/90 px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                                />
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <BacklogCategoryPicker
                                    compact
                                    categories={categories}
                                    selectedIds={todo.category_ids}
                                    onChange={(categoryIds) =>
                                      void handleTodoCategoriesChange(todo.id, categoryIds)
                                    }
                                  />
                                  <GoalPicker
                                    compact
                                    goals={goals}
                                    value={todo.goal_id}
                                    onChange={(goalId) => void handleTodoGoalChange(todo.id, goalId)}
                                  />
                                  <EisenhowerToggles
                                    compact
                                    value={{
                                      is_important: todo.is_important ?? null,
                                      is_urgent: todo.is_urgent ?? null,
                                    }}
                                    onChange={(fields) => void handleTodoEisenhowerChange(todo.id, fields)}
                                  />
                                  <QuadrantBadge
                                    value={{
                                      is_important: todo.is_important ?? null,
                                      is_urgent: todo.is_urgent ?? null,
                                    }}
                                  />
                                  <span className="text-[9px] text-slate-500">
                                    {todo.date ? `Due: ${todo.date}` : 'Unassigned'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setAssignOpenById((prev) => ({ ...prev, [todo.id]: !prev[todo.id] }))}
                                  className="rounded-md border border-[#ff9d00]/45 bg-black/30 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#ffe066] transition hover:bg-[#ff9d00]/15"
                                >
                                  Assign
                                </button>
                                <TodoDeleteButton
                                  compact
                                  itemLabel={todo.title}
                                  confirmMessage={`Delete "${todo.title}"? This removes it from your task backlog permanently.`}
                                  onConfirm={() => void handleDeleteTodo(todo)}
                                />
                              </div>
                            </div>

                            {assignOpenById[todo.id] ? (
                              <div className="flex flex-wrap items-center gap-1 pl-4.5 pt-0.5">
                                <input
                                  type="date"
                                  value={assignDateById[todo.id] ?? todo.date ?? todayString}
                                  onChange={(e) => setAssignDateById((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                                  className="rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-0.5 text-[11px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleAssignDate(todo.id)}
                                  className="rounded-md border border-emerald-400/45 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
                                >
                                  Save day
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex w-full items-center gap-1.5">
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white">
                          Categories
                        </span>
                        <select
                          value={doneCategoryFilter}
                          onChange={(e) => setDoneCategoryFilter(e.target.value as '' | 'all' | DoneCategory)}
                          aria-label="Categories filter"
                          className="w-full rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-1 pr-5 text-xs text-transparent focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                        >
                          <option value="" disabled>
                            Categories
                          </option>
                          <option value="all">All</option>
                          <option value="habit">Habit</option>
                          <option value="priority">Priority</option>
                          <option value="to-do">To-Do</option>
                        </select>
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white">
                          Date
                        </span>
                        <select
                          value={doneDateFilter}
                          onChange={(e) => setDoneDateFilter(e.target.value as DoneDateFilter)}
                          aria-label="Date filter"
                          className="w-full rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-1 pr-5 text-xs text-transparent focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                        >
                          <option value="" disabled>
                            Date
                          </option>
                          <option value="all">All</option>
                          <option value="today">Today</option>
                          <option value="this-week">This week</option>
                          <option value="this-month">This month</option>
                        </select>
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white">
                          Sort
                        </span>
                        <select
                          value={doneSort}
                          onChange={(e) => setDoneSort(e.target.value as DoneSort)}
                          aria-label="Sort order"
                          className="w-full rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-1 pr-5 text-xs text-transparent focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                        >
                          <option value="" disabled>
                            Sort
                          </option>
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                        </select>
                      </div>
                    </div>

                    {filteredDoneItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[#ff9d00]/35 bg-black/20 px-4 py-6 text-center text-sm text-slate-300">
                        No completed items match this filter yet.
                      </p>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1 min-w-0">
                        {filteredDoneItems.map((item) => (
                          <li key={item.id} className="rounded-md border border-emerald-400/20 bg-[#03060f]/70 p-1.5">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="break-words text-[12px] text-white">{item.title}</p>
                                <p className="mt-0.5 text-[10px] text-slate-400">{formatDoneItemTimestamp(item)}</p>
                              </div>
                              <span className="shrink-0 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
                                {item.category}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
