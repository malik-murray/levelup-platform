import { supabase } from '@auth/supabaseClient';

export async function deactivateHabitTemplate(habitId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated to delete habits');

  const { error } = await supabase
    .from('habit_templates')
    .update({ is_active: false })
    .eq('id', habitId)
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to delete habit: ${error.message}`);
}

export async function reorderHabitTemplates(habitIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated to reorder habits');

  for (let index = 0; index < habitIds.length; index++) {
    const { error } = await supabase
      .from('habit_templates')
      .update({ sort_order: index })
      .eq('id', habitIds[index])
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to reorder habits: ${error.message}`);
    }
  }
}
