import { supabase } from '@auth/supabaseClient';

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
