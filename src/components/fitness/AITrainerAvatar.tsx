'use client';

import Image from 'next/image';

type AITrainerAvatarProps = {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    alt?: string;
};

const SIZE_CLASSES: Record<NonNullable<AITrainerAvatarProps['size']>, string> = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-20 w-20',
};

export default function AITrainerAvatar({
    size = 'md',
    className = '',
    alt = 'AI trainer avatar',
}: AITrainerAvatarProps) {
    return (
        <div className={`relative overflow-hidden rounded-full border border-amber-400/40 bg-slate-900 ${SIZE_CLASSES[size]} ${className}`}>
            <Image
                src="/api/fitness/ai-avatar"
                alt={alt}
                fill
                sizes="80px"
                className="object-cover"
            />
        </div>
    );
}
