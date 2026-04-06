'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { buildHabitOverallMomentumRows, type HabitMomentumRow } from '@/lib/trends/trendsHabitMomentum';
import type { HabitEntryRow, HabitTemplateRow } from '@/lib/trends/trendsPageTypes';

export type StreaksPageReadyModel = {
    habitMomentumRows: HabitMomentumRow[];
};

export function useStreaksPageData() {
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [templates, setTemplates] = useState<HabitTemplateRow[]>([]);
    const [entries, setEntries] = useState<HabitEntryRow[]>([]);

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            setUserId(user.id);
        })();
    }, []);

    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            setLoading(true);
            try {
                const [{ data: templateData }, { data: entryData }] = await Promise.all([
                    supabase
                        .from('habit_templates')
                        .select('id, name, icon, category, time_of_day, is_bad_habit, is_active')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .order('sort_order'),
                    supabase
                        .from('habit_daily_entries')
                        .select('habit_template_id, date, status')
                        .eq('user_id', userId)
                        .order('date', { ascending: true }),
                ]);

                setTemplates((templateData || []) as HabitTemplateRow[]);
                setEntries((entryData || []) as HabitEntryRow[]);
            } catch (err) {
                console.error('Error loading streaks:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [userId]);

    const habitMomentumRows = useMemo(
        () => buildHabitOverallMomentumRows(templates, entries),
        [templates, entries],
    );

    return {
        loading,
        habitMomentumRows,
    };
}
