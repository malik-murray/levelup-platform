'use client';

import { supabase } from '@auth/supabaseClient';
import {
    upsertFitnessUserProfileForUser,
    updateFitnessUserProfileForUser,
    type FitnessUserProfile,
} from '@/lib/fitness/profile';
import { profileToFormValues } from '@/lib/fitness/profileFormOptions';
import FitnessProfileForm from '@/app/fitness/components/FitnessProfileForm';
import { neon } from '../neonTheme';

export default function FitnessGoalsOverlay({
    profile,
    onClose,
    onSaved,
}: {
    profile: FitnessUserProfile | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const handleSubmit = async (input: Parameters<typeof updateFitnessUserProfileForUser>[1]) => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        if (profile) {
            await updateFitnessUserProfileForUser(user.id, input, supabase);
        } else {
            await upsertFitnessUserProfileForUser(user.id, input, supabase);
        }
        onSaved();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className={`${neon.panel} max-h-[90vh] w-full max-w-2xl overflow-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b border-[#ff9d00]/25 bg-[#010205]/95 px-4 py-3 backdrop-blur-md">
                    <h2 className="text-xl font-bold text-[#ffe066]">
                        {profile ? 'Edit fitness goals' : 'Set your fitness goals'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-[#ff9d00]/40 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-[#ff9d00]/10"
                    >
                        Close
                    </button>
                </div>
                <div className="p-4">
                    <FitnessProfileForm
                        key={profile?.updated_at ?? 'new'}
                        initialValues={profile ? profileToFormValues(profile) : undefined}
                        title={undefined}
                        description="Update your goals, schedule, and coach preferences. Changes apply to your workout recommendations right away."
                        submitLabel={profile ? 'Save goals' : 'Save and get started'}
                        onSubmit={handleSubmit}
                    />
                </div>
            </div>
        </div>
    );
}
