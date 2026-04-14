'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';
import { formatDate } from '@/lib/habitHelpers';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

type TodoItem = {
  id: string;
  title: string;
  is_done: boolean;
  date: string;
  created_at: string | null;
};

const normalizeTodoTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function TodoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignOpenById, setAssignOpenById] = useState<Record<string, boolean>>({});
  const [assignDateById, setAssignDateById] = useState<Record<string, string>>({});

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
    void loadTodos(userId);
  }, [userId]);

  const loadTodos = async (activeUserId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('habit_daily_todos')
        .select('id, title, is_done, date, created_at')
        .eq('user_id', activeUserId)
        .eq('is_done', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rows = data ?? [];

      // Keep one unfinished row per normalized title, remove accidental duplicates.
      const groupedByTitle = new Map<string, TodoItem[]>();
      rows.forEach((todo) => {
        const key = normalizeTodoTitle(todo.title);
        if (!groupedByTitle.has(key)) groupedByTitle.set(key, []);
        groupedByTitle.get(key)!.push(todo);
      });

      const dedupedRows: TodoItem[] = [];
      const duplicateIdsToDelete: string[] = [];

      groupedByTitle.forEach((group) => {
        const sortedGroup = [...group].sort((a, b) => {
          const aCreated = a.created_at ?? '';
          const bCreated = b.created_at ?? '';
          if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.id.localeCompare(b.id);
        });

        const canonical = sortedGroup[0];
        dedupedRows.push(canonical);
        sortedGroup.slice(1).forEach((dupe) => duplicateIdsToDelete.push(dupe.id));
      });

      if (duplicateIdsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('habit_daily_todos')
          .delete()
          .eq('user_id', activeUserId)
          .in('id', duplicateIdsToDelete);
        if (deleteError) {
          console.error('Error deleting duplicate to-dos:', deleteError);
        }
      }

      dedupedRows.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.created_at ?? '').localeCompare(a.created_at ?? '');
      });
      setTodos(dedupedRows);

      const nextAssignDates: Record<string, string> = {};
      dedupedRows.forEach((todo) => {
        nextAssignDates[todo.id] = todo.date;
      });
      setAssignDateById(nextAssignDates);
    } catch (err) {
      console.error('Error loading backlog to-dos:', err);
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
      const { error } = await supabase.from('habit_daily_todos').insert({
        user_id: userId,
        title: trimmed,
        date: todayString,
        is_done: false,
      });
      if (error) throw error;
      setNewTodoTitle('');
      await loadTodos(userId);
    } catch (err) {
      console.error('Error adding to-do:', err);
    }
  };

  const handleToggleTodo = async (todo: TodoItem) => {
    if (!userId) return;
    const completedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('habit_daily_todos')
        .update({ is_done: true, completed_at: completedAt })
        .eq('id', todo.id)
        .eq('user_id', userId);
      if (error) throw error;
      setTodos((prev) => prev.filter((item) => item.id !== todo.id));
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
      try {
        const { error } = await supabase
          .from('habit_daily_todos')
          .delete()
          .eq('id', todoId)
          .eq('user_id', userId);
        if (error) throw error;
        await loadTodos(userId);
      } catch (err) {
        console.error('Error removing duplicate after rename:', err);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('habit_daily_todos')
        .update({ title: trimmed })
        .eq('id', todoId)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (err) {
      console.error('Error renaming to-do item:', err);
    }
  };

  const handleAssignDate = async (todoId: string) => {
    if (!userId) return;
    const selectedDate = assignDateById[todoId];
    if (!selectedDate) return;
    try {
      const { error } = await supabase
        .from('habit_daily_todos')
        .update({ date: selectedDate })
        .eq('id', todoId)
        .eq('user_id', userId);
      if (error) throw error;
      setTodos((prev) => prev.map((item) => (item.id === todoId ? { ...item, date: selectedDate } : item)));
      setAssignOpenById((prev) => ({ ...prev, [todoId]: false }));
    } catch (err) {
      console.error('Error assigning to-do date:', err);
    }
  };

  if (loading) {
    return (
      <main className={`${outfit.className} flex min-h-dvh items-center justify-center bg-[#010205] text-white`}>
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
        <div className="pointer-events-none absolute inset-0" aria-hidden>
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
                className="text-center text-2xl font-extrabold tracking-tight text-[#a7f3d0] sm:text-3xl"
                style={{ textShadow: '0 0 16px rgba(110,231,183,0.25)' }}
              >
                To-Do Backlog
              </h1>
              <p className="mt-2 text-center text-sm text-slate-300">
                Keep every unfinished task in one place, then assign each item to a specific day when you are ready.
              </p>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto pb-20">
            <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-4 lg:max-w-4xl">
              <section className={`${neon.panel} p-3`}>
                <div className="mb-3 flex items-start gap-2">
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
                    className="min-h-[2.1rem] flex-1 resize-none break-words overflow-y-auto rounded-md border border-[#ff9d00]/25 bg-[#03060f]/90 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddTodo()}
                    className="shrink-0 rounded-md border border-[#ff9d00]/55 bg-[#ff9d00]/10 px-2.5 py-1.5 text-xs font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/20"
                  >
                    Add
                  </button>
                </div>

                {todos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#ff9d00]/35 bg-black/20 px-4 py-6 text-center text-sm text-slate-300">
                    Nothing pending right now. Add new items above to keep your task brain clear.
                  </p>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5 min-w-0">
                    {todos.map((todo) => (
                      <li key={todo.id} className="space-y-1.5 rounded-md border border-[#ff9d00]/20 bg-[#03060f]/70 p-2">
                        <div className="flex min-w-0 items-start gap-1.5">
                          <input
                            type="checkbox"
                            checked={todo.is_done}
                            onChange={() => void handleToggleTodo(todo)}
                            className="mt-1.5 h-4 w-4 shrink-0 rounded border-[#ff9d00]/50 text-[#ff9d00] focus:ring-[#ff9d00]/40"
                          />
                          <textarea
                            value={todo.title}
                            onChange={(e) => {
                              const nextTitle = e.target.value;
                              setTodos((prev) => prev.map((item) => (item.id === todo.id ? { ...item, title: nextTitle } : item)));
                            }}
                            onBlur={(e) => void handleTitleBlur(todo.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.target as HTMLTextAreaElement).blur()}
                            rows={1}
                            className="min-h-[2.1rem] flex-1 resize-none break-words overflow-y-auto rounded-md border border-[#ff9d00]/25 bg-[#03060f]/90 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                          />
                          <button
                            type="button"
                            onClick={() => setAssignOpenById((prev) => ({ ...prev, [todo.id]: !prev[todo.id] }))}
                            className="rounded-md border border-[#ff9d00]/45 bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ffe066] transition hover:bg-[#ff9d00]/15"
                          >
                            Assign
                          </button>
                        </div>

                        {assignOpenById[todo.id] ? (
                          <div className="flex flex-wrap items-center gap-1.5 pl-5 pt-0.5">
                            <input
                              type="date"
                              value={assignDateById[todo.id] ?? todo.date}
                              onChange={(e) => setAssignDateById((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                              className="rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-2 py-1 text-xs text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAssignDate(todo.id)}
                              className="rounded-md border border-emerald-400/45 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
                            >
                              Save day
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
