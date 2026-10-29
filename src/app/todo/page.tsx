'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';
import { formatDate } from '@/lib/habitHelpers';
import { compareByQuadrant, getQuadrant, groupByQuadrant, QUADRANT_META, QUADRANT_ORDER, quadrantBadgeClasses, type EisenhowerFields, type EisenhowerQuadrant } from '@/lib/habit/eisenhower';
import { focusScore } from '@/lib/habit/focusScore';
import { EisenhowerToggles, QuadrantBadge } from '@/components/habit/EisenhowerToggles';
import {
  assignBacklogTodoToDate,
  deleteBacklogTask,
  deleteBacklogTodo,
  repairOrphanedBacklogTasks,
  setBacklogTaskCategories,
  setTodoCategories,
  syncBacklogCompletion,
  syncBacklogDueDate,
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
  due_date: string | null;
};

type TodoDraft = {
  title: string;
  is_important: boolean | null;
  is_urgent: boolean | null;
  due_date: string | null;
  category_ids: string[];
  goal_id: string | null;
};

const isBacklogOnly = (todo: TodoItem) => todo.daily_todo_id === null;

const draftFromTodo = (todo: TodoItem): TodoDraft => ({
  title: todo.title,
  is_important: todo.is_important,
  is_urgent: todo.is_urgent,
  due_date: todo.due_date,
  category_ids: [...todo.category_ids],
  goal_id: todo.goal_id,
});

const sameCategoryIds = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
};

const isDraftDirty = (todo: TodoItem, draft: TodoDraft) =>
  draft.title.trim() !== todo.title.trim() ||
  draft.is_important !== todo.is_important ||
  draft.is_urgent !== todo.is_urgent ||
  draft.due_date !== todo.due_date ||
  draft.goal_id !== todo.goal_id ||
  !sameCategoryIds(draft.category_ids, todo.category_ids);

const displayTodo = (todo: TodoItem, draft: TodoDraft | undefined): TodoItem =>
  draft ? { ...todo, ...draft, category_ids: [...draft.category_ids] } : todo;

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
  const [newTodoQuadrant, setNewTodoQuadrant] = useState<EisenhowerFields>({
    is_important: true,
    is_urgent: true,
  });
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
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
  const [draftsById, setDraftsById] = useState<Record<string, TodoDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const goals = useGoalsForPicker(userId);

  const patchDraft = (todo: TodoItem, patch: Partial<TodoDraft>) => {
    setDraftsById((prev) => {
      const base = prev[todo.id] ?? draftFromTodo(todo);
      const next = { ...base, ...patch };
      if (!isDraftDirty(todo, next)) {
        const { [todo.id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [todo.id]: next };
    });
  };

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
          .select('id, title, assigned_date, created_at, is_important, is_urgent, goal_id, due_date')
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
          due_date: null,
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

      const dueDateByBacklogId = new Map(
        backlogTasks.map((task) => [task.id, task.due_date ?? null])
      );

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
        due_date: todo.backlog_task_id ? dueDateByBacklogId.get(todo.backlog_task_id) ?? null : null,
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
        due_date: task.due_date ?? null,
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
          is_important: newTodoQuadrant.is_important ?? false,
          is_urgent: newTodoQuadrant.is_urgent ?? false,
          due_date: newTodoDueDate || null,
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
          due_date: newTodoDueDate || null,
        };
        setTodos((prev) => sortTodoItems([item, ...prev]));
        setAssignDateById((prev) => ({ ...prev, [data.id]: todayString }));
      }
      setNewTodoTitle('');
      setNewTodoCategoryIds([]);
      setNewTodoGoalId(null);
      setNewTodoQuadrant({ is_important: true, is_urgent: true });
      setNewTodoDueDate('');
    } catch (err) {
      console.error('Error adding to-do:', err);
    }
  };

  const handleDeleteTodo = async (todo: TodoItem) => {
    if (!userId) return;

    const previousTodos = todos;
    const previousDraft = draftsById[todo.id];
    setTodos((prev) => prev.filter((item) => item.id !== todo.id));
    handleDiscardTodoDraft(todo.id);
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
      if (previousDraft) {
        setDraftsById((prev) => ({ ...prev, [todo.id]: previousDraft }));
      }
    }
  };

  const handleToggleTodo = async (todo: TodoItem) => {
    if (!userId) return;
    if (draftsById[todo.id] && isDraftDirty(todo, draftsById[todo.id])) {
      const proceed = window.confirm('This task has unsaved changes. Mark it done anyway?');
      if (!proceed) return;
    }
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
      handleDiscardTodoDraft(todo.id);
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

  const handleDiscardTodoDraft = (todoId: string) => {
    setDraftsById((prev) => {
      const { [todoId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveTodoDraft = async (todoId: string) => {
    if (!userId) return;
    const todo = todos.find((item) => item.id === todoId);
    const draft = draftsById[todoId];
    if (!todo || !draft || !isDraftDirty(todo, draft)) return;

    const trimmed = draft.title.trim();
    if (!trimmed) return;

    const normalized = normalizeTodoTitle(trimmed);
    const duplicate = todos.find((item) => item.id !== todoId && normalizeTodoTitle(item.title) === normalized);
    if (duplicate) return;

    setSavingById((prev) => ({ ...prev, [todoId]: true }));
    try {
      const titleChanged = trimmed !== todo.title.trim();
      const eisenhowerChanged =
        draft.is_important !== todo.is_important || draft.is_urgent !== todo.is_urgent;
      const dueChanged = draft.due_date !== todo.due_date;
      const goalChanged = draft.goal_id !== todo.goal_id;
      const categoriesChanged = !sameCategoryIds(draft.category_ids, todo.category_ids);

      if (isBacklogOnly(todo) && todo.backlog_task_id) {
        if (titleChanged) await syncBacklogTitle(todo.backlog_task_id, trimmed);
        if (eisenhowerChanged) {
          await syncBacklogEisenhower(todo.backlog_task_id, {
            is_important: draft.is_important,
            is_urgent: draft.is_urgent,
          });
        }
        if (dueChanged) await syncBacklogDueDate(todo.backlog_task_id, draft.due_date);
        if (goalChanged) await updateBacklogTaskGoal(userId, todo.backlog_task_id, draft.goal_id);
        if (categoriesChanged) await setBacklogTaskCategories(userId, todo.backlog_task_id, draft.category_ids);
      } else if (todo.daily_todo_id) {
        if (titleChanged) {
          const { error } = await supabase
            .from('habit_daily_todos')
            .update({ title: trimmed })
            .eq('id', todo.daily_todo_id)
            .eq('user_id', userId);
          if (error) throw error;
        }
        if (eisenhowerChanged) {
          await updateTodoEisenhower(
            todo.daily_todo_id,
            userId,
            { is_important: draft.is_important, is_urgent: draft.is_urgent },
            todo.backlog_task_id
          );
        }
        if (dueChanged && todo.backlog_task_id) {
          await syncBacklogDueDate(todo.backlog_task_id, draft.due_date);
        }
        if (goalChanged) await updateTodoGoal(todo.daily_todo_id, userId, draft.goal_id);
        if (categoriesChanged) {
          await setTodoCategories(todo.daily_todo_id, userId, draft.category_ids, todo.backlog_task_id);
        }
      } else {
        return;
      }

      setTodos((prev) =>
        prev.map((item) =>
          item.id === todoId
            ? {
                ...item,
                title: trimmed,
                is_important: draft.is_important,
                is_urgent: draft.is_urgent,
                due_date: draft.due_date,
                goal_id: draft.goal_id,
                category_ids: [...draft.category_ids],
              }
            : item
        )
      );
      handleDiscardTodoDraft(todoId);
    } catch (err) {
      console.error('Error saving task changes:', err);
    } finally {
      setSavingById((prev) => {
        const { [todoId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  useEffect(() => {
    const dirtyCount = Object.keys(draftsById).length;
    if (dirtyCount === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [draftsById]);

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

  const tasksByQuadrant = useMemo(() => groupByQuadrant(filteredTodos), [filteredTodos]);
  const visibleQuadrants: Array<(typeof QUADRANT_ORDER)[number]> =
    quadrantFilter === 'q1' || quadrantFilter === 'q2' || quadrantFilter === 'q3' || quadrantFilter === 'q4'
      ? [quadrantFilter]
      : [...QUADRANT_ORDER];

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
          due_date: todo.due_date,
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
                Create tasks here, put each one in a quadrant, then assign it to a day. The dashboard shows that day's tasks in the same quadrants.
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
                      <EisenhowerToggles
                        compact
                        value={newTodoQuadrant}
                        onChange={setNewTodoQuadrant}
                      />
                      <QuadrantBadge value={newTodoQuadrant} />
                      <input
                        type="date"
                        aria-label="Due date"
                        value={newTodoDueDate}
                        onChange={(e) => setNewTodoDueDate(e.target.value)}
                        className="rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-1 text-[11px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
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
                      <div className="space-y-3">
                        {visibleQuadrants.map((quadrant) => {
                          const quadrantTodos = [...tasksByQuadrant[quadrant]].sort(
                            (a, b) => (focusScore(b, todayString) ?? -1) - (focusScore(a, todayString) ?? -1)
                          );
                          const meta = QUADRANT_META[quadrant];
                          return (
                            <section key={quadrant} aria-label={meta.label}>
                              <div className={`mb-1.5 rounded-md border px-2 py-1.5 ${quadrantBadgeClasses(quadrant)}`}>
                                <p className="text-[11px] font-bold uppercase tracking-wide">
                                  {meta.shortLabel} · {meta.label}
                                </p>
                                <p className="text-[10px] opacity-80">{meta.description}</p>
                              </div>
                              {quadrantTodos.length === 0 ? (
                                <p className="px-2 py-2 text-[11px] text-slate-500">No tasks in this quadrant.</p>
                              ) : (
                      <ol className="space-y-1 min-w-0">
                        {quadrantTodos.map((todo, index) => {
                          const draft = draftsById[todo.id];
                          const view = displayTodo(todo, draft);
                          const dirty = Boolean(draft && isDraftDirty(todo, draft));
                          const saving = Boolean(savingById[todo.id]);
                          return (
                          <li
                            key={todo.id}
                            className={`space-y-1 rounded-md border p-1.5 ${
                              dirty
                                ? 'border-[#ffe066]/55 bg-[#ff9d00]/10'
                                : 'border-[#ff9d00]/20 bg-[#03060f]/70'
                            }`}
                          >
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
                                  value={view.title}
                                  onChange={(e) => patchDraft(todo, { title: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      (e.target as HTMLTextAreaElement).blur();
                                    }
                                  }}
                                  rows={1}
                                  className="min-h-[1.8rem] w-full resize-none break-words overflow-y-auto rounded-md border border-[#ff9d00]/25 bg-[#03060f]/90 px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                                />
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <BacklogCategoryPicker
                                    compact
                                    categories={categories}
                                    selectedIds={view.category_ids}
                                    onChange={(categoryIds) => patchDraft(todo, { category_ids: categoryIds })}
                                  />
                                  <GoalPicker
                                    compact
                                    goals={goals}
                                    value={view.goal_id}
                                    onChange={(goalId) => patchDraft(todo, { goal_id: goalId })}
                                  />
                                  <EisenhowerToggles
                                    compact
                                    value={{
                                      is_important: view.is_important ?? null,
                                      is_urgent: view.is_urgent ?? null,
                                    }}
                                    onChange={(fields) =>
                                      patchDraft(todo, {
                                        is_important: fields.is_important,
                                        is_urgent: fields.is_urgent,
                                      })
                                    }
                                  />
                                  <QuadrantBadge
                                    value={{
                                      is_important: view.is_important ?? null,
                                      is_urgent: view.is_urgent ?? null,
                                    }}
                                  />
                                  <input
                                    type="date"
                                    aria-label={`Due date for ${view.title}`}
                                    value={view.due_date ?? ''}
                                    onChange={(e) => patchDraft(todo, { due_date: e.target.value || null })}
                                    className="rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-0.5 text-[11px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                                  />
                                  <span className="text-[10px] font-semibold tabular-nums text-[#ffe066]">
                                    Score {focusScore(view, todayString) ?? '—'}
                                  </span>
                                  <span className="text-[9px] text-slate-500">
                                    {todo.date ? `Due: ${todo.date}` : 'Unassigned'}
                                  </span>
                                </div>
                                {dirty ? (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="text-[10px] font-medium text-[#ffe066]">Unsaved changes</span>
                                    <button
                                      type="button"
                                      disabled={saving || !view.title.trim()}
                                      onClick={() => void handleSaveTodoDraft(todo.id)}
                                      className="rounded-md border border-emerald-400/55 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {saving ? 'Saving…' : 'Save changes'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => handleDiscardTodoDraft(todo.id)}
                                      className="rounded-md border border-slate-500/50 bg-black/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Discard
                                    </button>
                                  </div>
                                ) : null}
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
                                  itemLabel={view.title}
                                  confirmMessage={`Delete "${view.title}"? This removes it from your task backlog permanently.`}
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
                          );
                        })}
                      </ol>
                              )}
                            </section>
                          );
                        })}
                      </div>
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
