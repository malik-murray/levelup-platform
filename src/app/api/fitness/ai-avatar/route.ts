import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

const fallbackAvatarPath =
    '/Users/levelupsolutions/.cursor/projects/Users-levelupsolutions-Projects-LevelUpOS-levelup-platform/assets/D4EF9026-57D0-4A6B-8427-B9113E9313EA-85137106-72cf-4c59-9f5a-4be13caa7d02.png';

export async function GET() {
    const avatarPath = process.env.FITNESS_AI_TRAINER_AVATAR_PATH || fallbackAvatarPath;
    try {
        const file = await readFile(avatarPath);
        return new NextResponse(file, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Trainer avatar not found',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 404 }
        );
    }
}
