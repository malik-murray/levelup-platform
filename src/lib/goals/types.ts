export const GOAL_CATEGORIES = [
  'financial',
  'physical',
  'spiritual',
  'business',
  'personal',
  'mental',
  'health',
  'career',
  'relationships',
  'education',
  'other',
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export type HabitGoal = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  vision_statement: string | null;
  category: GoalCategory | null;
  target_value: number | null;
  target_unit: string | null;
  current_value: number | null;
  priority_score: number | null;
  deadline: string | null;
  is_completed: boolean;
  is_archived: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type HabitMilestone = {
  id: string;
  user_id: string;
  goal_id: string;
  name: string;
  description: string | null;
  values: number[];
  current_value: number | null;
  due_date: string | null;
  is_completed: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalDueDateFilter =
  | 'all'
  | 'overdue'
  | 'this-week'
  | 'this-month'
  | 'no-deadline';

export type LinkedItemType = 'habit' | 'priority' | 'todo' | 'backlog' | 'weekly';

export type LinkedItem = {
  id: string;
  type: LinkedItemType;
  title: string;
  completed: boolean;
  date?: string | null;
};

export type GoalWithMilestones = HabitGoal & {
  milestones: HabitMilestone[];
  linkedItems: LinkedItem[];
};

export type GoalFormValues = {
  name: string;
  description: string;
  vision_statement: string;
  category: GoalCategory | '';
  deadline: string;
  target_value: string;
  target_unit: string;
};

export type MilestoneFormValues = {
  name: string;
  description: string;
  due_date: string;
  target_value: string;
};

/** Milestone row in the goal create/edit form */
export type MilestoneDraft = {
  clientId: string;
  id?: string;
  name: string;
  description: string;
  due_date: string;
  target_value: string;
  is_completed: boolean;
};

export type GoalFormSavePayload = {
  goal: GoalFormValues;
  milestones: MilestoneDraft[];
  removedMilestoneIds: string[];
  linkedHabitIds: string[];
};
