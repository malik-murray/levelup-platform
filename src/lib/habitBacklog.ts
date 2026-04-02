import { supabase } from '@auth/supabaseClient';

export type BacklogItemType = 'priority' | 'todo';

const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Financial', 'Business', 'Relationships'];

export async function ensureDefaultBacklogCategories(userId: string) {
    const rows = DEFAULT_CATEGORIES.map((name) => ({ user_id: userId, name }));
    await supabase.from('habit_backlog_categories').upsert(rows, { onConflict: 'user_id,name' });
}

export async function getUncategorizedCategoryId(userId: string): Promise<string | null> {
    const { data: existing } = await supabase
        .from('habit_backlog_categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Uncategorized')
        .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created } = await supabase
        .from('habit_backlog_categories')
        .insert({ user_id: userId, name: 'Uncategorized' })
        .select('id')
        .single();

    return created?.id ?? null;
}

export async function createBacklogTaskFromDailyItem(params: {
    userId: string;
    title: string;
    assignedDate: string;
    dailyItemType: BacklogItemType;
    priorityRank?: number | null;
    categoryId?: string | null;
}) {
    const { userId, title, assignedDate, dailyItemType, priorityRank, categoryId } = params;
    const { data, error } = await supabase
        .from('habit_backlog_tasks')
        .insert({
            user_id: userId,
            title,
            category_id: categoryId ?? null,
            priority_rank: priorityRank && priorityRank > 0 ? priorityRank : 9999,
            assigned_date: assignedDate,
            daily_item_type: dailyItemType,
            completed_at: null,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function syncBacklogCompletion(backlogTaskId: string, completed: boolean) {
    const completedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .update({ completed_at: completedAt })
        .eq('id', backlogTaskId);
    if (error) throw error;
}

export async function syncBacklogTitle(backlogTaskId: string, title: string) {
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .update({ title })
        .eq('id', backlogTaskId);
    if (error) throw error;
}

export function effectiveAssignedDate(task: { assigned_date: string | null; completed_at: string | null }, today: string) {
    if (!task.assigned_date) return null;
    if (!task.completed_at && task.assigned_date < today) return null;
    return task.assigned_date;
}

type BacklogTemplateTask = {
    title: string;
    categoryName: string;
    // Lower number = higher priority
    priorityRank: number;
};

// Seed tasks for the Master Backlog. Titles are used to de-dupe.
const MASTER_BACKLOG_TEMPLATE_TASKS: BacklogTemplateTask[] = [
    // Legal
    { title: 'Work on my cases (criminal / custody / child support)', categoryName: 'Legal', priorityRank: 1 },
    { title: 'Get Nana fire stick', categoryName: 'Legal', priorityRank: 2 },
    { title: 'Set up schedule to see/talk to: Nana', categoryName: 'Legal', priorityRank: 3 },
    { title: 'Set up schedule to see/talk to: Cel', categoryName: 'Legal', priorityRank: 4 },
    { title: 'Set up schedule to see/talk to: Mommy', categoryName: 'Legal', priorityRank: 5 },
    { title: 'Set up schedule to see/talk to: Man', categoryName: 'Legal', priorityRank: 6 },
    { title: 'Take Kai to see Auntie', categoryName: 'Legal', priorityRank: 7 },

    // Financial
    { title: 'Finish Taxes', categoryName: 'Financial', priorityRank: 8 },
    { title: 'Set up trust', categoryName: 'Financial', priorityRank: 9 },
    { title: 'Budget', categoryName: 'Financial', priorityRank: 10 },
    { title: 'Financial assessment', categoryName: 'Financial', priorityRank: 11 },
    { title: 'Set up insurance', categoryName: 'Financial', priorityRank: 12 },
    { title: 'Set up investments (me + kids)', categoryName: 'Financial', priorityRank: 13 },
    { title: 'Set up savings (me + kids)', categoryName: 'Financial', priorityRank: 14 },
    { title: 'Build similar financial systems (automation / tracking)', categoryName: 'Financial', priorityRank: 15 },

    // Work - Engineering / Systems
    { title: 'CPAP report / automation', categoryName: 'Work - Engineering / Systems', priorityRank: 16 },
    { title: 'Study Engineering Manual', categoryName: 'Work - Engineering / Systems', priorityRank: 17 },
    { title: 'Set up Engineering Bot', categoryName: 'Work - Engineering / Systems', priorityRank: 18 },
    { title: 'Q&A SharePoint Bot', categoryName: 'Work - Engineering / Systems', priorityRank: 19 },
    { title: 'Clean up Engineering SharePoint site', categoryName: 'Work - Engineering / Systems', priorityRank: 20 },
    { title: 'Shadow engineers', categoryName: 'Work - Engineering / Systems', priorityRank: 21 },
    { title: 'Study reporting team info', categoryName: 'Work - Engineering / Systems', priorityRank: 22 },
    { title: 'Study WEP program', categoryName: 'Work - Engineering / Systems', priorityRank: 23 },

    // Business / App Development (LevelUp Ecosystem)
    { title: 'Build Habit App (get up & running + able to sell)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 24 },
    { title: 'Build Finance (LevelUp app)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 25 },
    { title: 'Build Fitness (LevelUp app)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 26 },
    { title: 'Build Stock/Crypto (LevelUp app)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 27 },
    { title: 'Build Reflection / Lessons (LevelUp app)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 28 },
    { title: 'Build Newsfeed (LevelUp app)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 29 },
    { title: 'Build MVPs', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 30 },
    { title: 'Start consulting (AI / automation / freelancer / outreach / social media)', categoryName: 'Business / App Development (LevelUp Ecosystem)', priorityRank: 31 },

    // Personal Systems / Lifestyle
    { title: 'Create meal routine', categoryName: 'Personal Systems / Lifestyle', priorityRank: 32 },
    { title: 'Set up fitness workout plan', categoryName: 'Personal Systems / Lifestyle', priorityRank: 33 },

    // Relationships / Social
    { title: 'Set up family gatherings', categoryName: 'Relationships / Social', priorityRank: 34 },
    { title: 'Set up friends gatherings', categoryName: 'Relationships / Social', priorityRank: 35 },
];

export async function importMasterBacklogTemplate(userId: string) {
    // Ensure seeded categories exist for this user (keeps your default set intact)
    await ensureDefaultBacklogCategories(userId);

    const categoryNames = Array.from(new Set(MASTER_BACKLOG_TEMPLATE_TASKS.map((t) => t.categoryName)));
    const categoryRows = categoryNames.map((name) => ({ user_id: userId, name }));

    // Add missing categories for this template.
    await supabase.from('habit_backlog_categories').upsert(categoryRows, { onConflict: 'user_id,name' });

    const { data: categories } = await supabase
        .from('habit_backlog_categories')
        .select('id,name')
        .eq('user_id', userId)
        .in(
            'name',
            categoryNames
        );

    const categoryIdByName: Record<string, string> = Object.fromEntries((categories || []).map((c) => [c.name, c.id]));
    const titles = MASTER_BACKLOG_TEMPLATE_TASKS.map((t) => t.title);

    const { data: existing } = await supabase
        .from('habit_backlog_tasks')
        .select('title')
        .eq('user_id', userId)
        .in('title', titles);

    const existingTitles = new Set((existing || []).map((r) => r.title));
    const insertRows = MASTER_BACKLOG_TEMPLATE_TASKS.filter((t) => !existingTitles.has(t.title)).map((t) => ({
        user_id: userId,
        title: t.title,
        category_id: categoryIdByName[t.categoryName] ?? null,
        priority_rank: t.priorityRank,
        assigned_date: null,
        daily_item_type: null,
        completed_at: null,
    }));

    if (insertRows.length === 0) return { inserted: 0 };

    const { error } = await supabase.from('habit_backlog_tasks').insert(insertRows);
    if (error) throw error;

    return { inserted: insertRows.length };
}
