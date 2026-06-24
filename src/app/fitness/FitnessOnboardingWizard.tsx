'use client';

import { supabase } from '@auth/supabaseClient';
import { upsertFitnessUserProfileForUser } from '@/lib/fitness/profile';
import FitnessProfileForm from './components/FitnessProfileForm';

type Props = {
    onCompleted: () => void;
};

export default function FitnessOnboardingWizard({ onCompleted }: Props) {
    const handleSubmit = async (input: Parameters<typeof upsertFitnessUserProfileForUser>[1]) => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        await upsertFitnessUserProfileForUser(user.id, input, supabase);
        onCompleted();
    };

    return (
        <FitnessProfileForm
            title="Welcome to Fitness"
            description="Answer a few questions so we can tailor your training plan. You can update these later in Settings."
            submitLabel="Complete onboarding"
            onSubmit={handleSubmit}
        />
    );
}
