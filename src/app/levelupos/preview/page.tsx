import { notFound } from 'next/navigation';
import CommandCenter from '../CommandCenter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'LevelUpOS | Local Preview' };

export default function LocalPreview() {
    // Read-only fixtures; never bypass the real page or API authentication.
    if (process.env.NODE_ENV !== 'development' || process.env.LEVELUPOS_LOCAL_PREVIEW !== 'true') notFound();
    return <CommandCenter preview />;
}
