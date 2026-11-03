import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import CommandCenter from './CommandCenter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'LevelUpOS | Command Center' };

export default async function LevelUpOSPage() {
    const auth = await getAuthenticatedUser();
    if (!auth) redirect('/login');
    return <CommandCenter />;
}
