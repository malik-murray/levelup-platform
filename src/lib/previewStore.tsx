'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'levelup_preview_data';

// Types aligned with app usage (habit, finance, fitness)
export type PreviewCategory = 'physical' | 'mental' | 'spiritual';
export type PreviewTimeOfDay = 'morning' | 'afternoon' | 'evening';
export type PreviewHabitStatus = 'checked' | 'missed';

export type PreviewHabitTemplate = {
  id: string;
  name: string;
  icon: string;
  category: PreviewCategory;
  time_of_day: PreviewTimeOfDay | null;
  goal_id: string | null;
  is_bad_habit: boolean;
  is_active: boolean;
  sort_order: number | null;
};

export type PreviewHabitEntry = {
  id: string;
  habit_template_id: string;
  date: string;
  status: PreviewHabitStatus;
  checked_at: string | null;
};

export type PreviewPriority = {
  id: string;
  text: string;
  category: PreviewCategory | null;
  time_of_day: PreviewTimeOfDay | null;
  completed: boolean;
  goal_id: string | null;
  completed_at: string | null;
  date?: string;
  sort_order?: number;
};

export type PreviewTodo = {
  id: string;
  title: string;
  category: PreviewCategory | null;
  time_of_day: PreviewTimeOfDay | null;
  is_done: boolean;
  goal_id: string | null;
  completed_at: string | null;
  date?: string;
};

export type PreviewDailyContent = {
  lessons: string | null;
  ideas: string | null;
  notes: string | null;
  distractions: string | null;
  reflection: string | null;
};

export type PreviewDailyScore = {
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
  date?: string;
};

export type PreviewHabitGoal = { id: string; name: string; is_completed?: boolean };

export type PreviewHabitData = {
  habitTemplates: PreviewHabitTemplate[];
  habitEntries: PreviewHabitEntry[];
  priorities: PreviewPriority[];
  todos: PreviewTodo[];
  dailyContent: Record<string, PreviewDailyContent>;
  dailyScores: Record<string, PreviewDailyScore>;
  goals: PreviewHabitGoal[];
  scoringSettings: { habits_weight: number; priorities_weight: number; todos_weight: number };
  monthPriorities: { date: string }[];
  monthTodos: { date: string }[];
};

export type PreviewAccount = {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other' | null;
  starting_balance: number | null;
};

export type PreviewCategoryFinance = {
  id: string;
  name: string;
  kind: 'group' | 'category';
  parent_id: string | null;
  type: 'income' | 'expense' | 'transfer' | string | null;
};

export type PreviewTransaction = {
  id: string;
  date: string;
  amount: number;
  person: string;
  note: string | null;
  account_id: string | null;
  category_id: string | null;
};

export type PreviewCategoryBudget = {
  id: string;
  category_id: string;
  month: string;
  amount: number;
};

export type PreviewFinanceData = {
  accounts: PreviewAccount[];
  categories: PreviewCategoryFinance[];
  transactions: PreviewTransaction[];
  budgets: PreviewCategoryBudget[];
};

export type PreviewWorkout = {
  id: string;
  date: string;
  type: string;
  muscle_group: string | null;
  duration_minutes: number;
  intensity: number | null;
  calories_burned: number | null;
  notes: string | null;
};

export type PreviewMeal = {
  id: string;
  date: string;
  meal_type: string;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type PreviewMetric = {
  id: string;
  date: string;
  weight_kg: number | null;
  steps: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
};

export type PreviewFitnessGoal = {
  daily_steps_target: number;
  daily_calories_target: number;
  daily_water_ml_target: number;
  weekly_workout_minutes_target: number;
};

export type PreviewFitnessData = {
  workouts: PreviewWorkout[];
  meals: PreviewMeal[];
  metrics: Record<string, PreviewMetric>;
  goals: PreviewFitnessGoal | null;
};

export type PreviewData = {
  habit: PreviewHabitData;
  finance: PreviewFinanceData;
  fitness: PreviewFitnessData;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultHabitData(): PreviewHabitData {
  return {
    habitTemplates: [],
    habitEntries: [],
    priorities: [],
    todos: [],
    dailyContent: {},
    dailyScores: {},
    goals: [],
    scoringSettings: { habits_weight: 40, priorities_weight: 35, todos_weight: 25 },
    monthPriorities: [],
    monthTodos: [],
  };
}

function defaultFinanceData(): PreviewFinanceData {
  return {
    accounts: [
      { id: 'preview-checking', name: 'Sample Checking', type: 'checking', starting_balance: 2500 },
      { id: 'preview-savings', name: 'Sample Savings', type: 'savings', starting_balance: 5000 },
    ],
    categories: [
      { id: 'preview-cat-food', name: 'Food & Dining', kind: 'category', parent_id: null, type: 'expense' },
      { id: 'preview-cat-transport', name: 'Transport', kind: 'category', parent_id: null, type: 'expense' },
      { id: 'preview-cat-income', name: 'Income', kind: 'category', parent_id: null, type: 'income' },
    ],
    transactions: [
      { id: 'preview-tx-1', date: new Date().toISOString().slice(0, 10), amount: -45, person: 'You', note: 'Sample expense', account_id: 'preview-checking', category_id: 'preview-cat-food' },
      { id: 'preview-tx-2', date: new Date().toISOString().slice(0, 10), amount: 3200, person: 'Employer', note: 'Sample income', account_id: 'preview-checking', category_id: 'preview-cat-income' },
    ],
    budgets: [
      { id: 'preview-budget-1', category_id: 'preview-cat-food', month: new Date().toISOString().slice(0, 7), amount: 400 },
    ],
  };
}

function defaultFitnessData(): PreviewFitnessData {
  return {
    workouts: [],
    meals: [],
    metrics: {},
    goals: {
      daily_steps_target: 10000,
      daily_calories_target: 2000,
      daily_water_ml_target: 2500,
      weekly_workout_minutes_target: 150,
    },
  };
}

function loadFromStorage(): PreviewData {
  if (typeof window === 'undefined') {
    return {
      habit: defaultHabitData(),
      finance: defaultFinanceData(),
      fitness: defaultFitnessData(),
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        habit: defaultHabitData(),
        finance: defaultFinanceData(),
        fitness: defaultFitnessData(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<PreviewData>;
    return {
      habit: { ...defaultHabitData(), ...parsed.habit },
      finance: { ...defaultFinanceData(), ...parsed.finance },
      fitness: { ...defaultFitnessData(), ...parsed.fitness },
    };
  } catch {
    return {
      habit: defaultHabitData(),
      finance: defaultFinanceData(),
      fitness: defaultFitnessData(),
    };
  }
}

function saveToStorage(data: PreviewData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Preview store save failed:', e);
  }
}

// Simple subscription for cross-tab / same-tab updates
let listeners: (() => void)[] = [];
function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
function notify() {
  listeners.forEach((l) => l());
}

let cached: PreviewData | null = null;
function getSnapshot(): PreviewData {
  if (cached) return cached;
  cached = loadFromStorage();
  return cached;
}
function getServerSnapshot(): PreviewData {
  return {
    habit: defaultHabitData(),
    finance: defaultFinanceData(),
    fitness: defaultFitnessData(),
  };
}

export function getPreviewData(): PreviewData {
  if (typeof window === 'undefined') return getServerSnapshot();
  if (!cached) cached = loadFromStorage();
  return cached;
}

export function setPreviewData(update: (prev: PreviewData) => PreviewData): void {
  const next = update(getPreviewData());
  cached = next;
  saveToStorage(next);
  notify();
}

export type PreviewContextValue = {
  isPreview: boolean;
  data: PreviewData;
  setData: (update: (prev: PreviewData) => PreviewData) => void;
  // Helpers for habit
  habit: PreviewHabitData;
  setHabit: (update: (prev: PreviewHabitData) => PreviewHabitData) => void;
  // Helpers for finance
  finance: PreviewFinanceData;
  setFinance: (update: (prev: PreviewFinanceData) => PreviewFinanceData) => void;
  // Helpers for fitness
  fitness: PreviewFitnessData;
  setFitness: (update: (prev: PreviewFitnessData) => PreviewFitnessData) => void;
  generateId: () => string;
};

const defaultContextValue: PreviewContextValue = {
  isPreview: false,
  data: getServerSnapshot(),
  setData: () => {},
  habit: defaultHabitData(),
  setHabit: () => {},
  finance: defaultFinanceData(),
  setFinance: () => {},
  fitness: defaultFitnessData(),
  setFitness: () => {},
  generateId,
};

export const PreviewContext = createContext<PreviewContextValue>(defaultContextValue);

export function usePreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  return ctx ?? defaultContextValue;
}

export function usePreviewData(): PreviewData {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return data;
}

export function PreviewProvider({
  children,
  isPreview = false,
}: {
  children: React.ReactNode;
  isPreview?: boolean;
}) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setData = useCallback((update: (prev: PreviewData) => PreviewData) => {
    setPreviewData(update);
  }, []);

  const setHabit = useCallback((update: (prev: PreviewHabitData) => PreviewHabitData) => {
    setPreviewData((prev) => ({ ...prev, habit: update(prev.habit) }));
  }, []);

  const setFinance = useCallback((update: (prev: PreviewFinanceData) => PreviewFinanceData) => {
    setPreviewData((prev) => ({ ...prev, finance: update(prev.finance) }));
  }, []);

  const setFitness = useCallback((update: (prev: PreviewFitnessData) => PreviewFitnessData) => {
    setPreviewData((prev) => ({ ...prev, fitness: update(prev.fitness) }));
  }, []);

  const value: PreviewContextValue = useMemo(
    () => ({
      isPreview,
      data,
      setData,
      habit: data.habit,
      setHabit,
      finance: data.finance,
      setFinance,
      fitness: data.fitness,
      setFitness,
      generateId,
    }),
    [isPreview, data, setData, setHabit, setFinance, setFitness]
  );

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function getPreviewDataForMigration(): PreviewData {
  return getPreviewData();
}

export function clearPreviewDataAfterMigration(): void {
  if (typeof window === 'undefined') return;
  cached = null;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}
