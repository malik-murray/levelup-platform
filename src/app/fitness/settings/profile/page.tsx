'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import {
    getFitnessUserProfileForUser,
    updateFitnessUserProfileForUser,
    type FitnessUserProfile,
} from '@/lib/fitness/profile';
import { profileToFormValues } from '@/lib/fitness/profileFormOptions';
import FitnessProfileForm from '../../components/FitnessProfileForm';

export default function FitnessProfileSettingsPage() {
    const [profile, setProfile] = useState<FitnessUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        void loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const data = await getFitnessUserProfileForUser(user.id, supabase);
            setProfile(data);
        } catch (error) {
            console.error('Error loading fitness profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (input: Parameters<typeof updateFitnessUserProfileForUser>[1]) => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        const updated = await updateFitnessUserProfileForUser(user.id, input, supabase);
        setProfile(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (loading) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>;
    }

    if (!profile) {
        return (
            <div className="max-w-2xl space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    You haven&apos;t set up your training profile yet.
                </p>
                <Link
                    href="/fitness"
                    className="inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
                >
                    Complete onboarding
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-4">
            {saved && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
                    Profile saved. Your next workout recommendation will use these settings.
                </div>
            )}

            <FitnessProfileForm
                key={profile.updated_at}
                initialValues={profileToFormValues(profile)}
                title="Training profile"
                description="Update your goals, equipment, schedule, and coach preferences. Changes apply to daily workout recommendations."
                submitLabel="Save profile"
                onSubmit={handleSubmit}
            />
        </div>
    );
}
