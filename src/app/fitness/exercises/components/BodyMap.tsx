'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BodyView, BodyRegionConfig } from './bodyMapConfig';
import { FRONT_REGIONS, BACK_REGIONS } from './bodyMapConfig';

type BodyMapProps = {
    selectedMuscleSlug: string;
    onSelectMuscleSlug: (slug: string) => void;
};

const viewLabel: Record<BodyView, string> = {
    front: 'Front',
    back: 'Back',
};

function regionIsSelected(region: BodyRegionConfig, selectedSlug: string) {
    return region.muscleSlug === selectedSlug;
}

/** Human body silhouette – front view. Organic shapes with smooth curves. */
function FrontSilhouette() {
    return (
        <g fill="currentColor" className="text-slate-600 dark:text-slate-500" fillOpacity="0.9">
            <ellipse cx="60" cy="20" rx="13" ry="16" />
            <path d="M52 36 Q60 34 68 36 L66 48 Q60 50 54 48 Z" />
            {/* Torso: tapered from shoulders to waist */}
            <path d="M30 50 Q28 52 30 55 L32 95 Q34 120 38 128 L42 130 Q60 132 78 130 L82 128 Q86 120 88 95 L90 55 Q92 52 90 50 Q75 46 60 48 Q45 46 30 50 Z" />
            {/* Left arm: natural hang with slight bend */}
            <path d="M30 50 Q22 55 18 72 Q16 95 20 118 L24 125 Q28 122 26 98 Q28 72 32 58 Z" />
            {/* Right arm */}
            <path d="M90 50 Q98 55 102 72 Q104 95 100 118 L96 125 Q92 122 94 98 Q92 72 88 58 Z" />
            {/* Hips */}
            <path d="M38 128 Q42 135 60 136 Q78 135 82 128 L84 152 Q82 156 60 156 Q38 156 36 152 Z" />
            {/* Left leg */}
            <path d="M36 152 Q34 158 36 178 Q38 198 40 218 L46 232 Q50 236 54 232 L56 222 Q54 198 52 172 Z" />
            {/* Right leg */}
            <path d="M84 152 Q86 158 84 178 Q82 198 80 218 L74 232 Q70 236 66 232 L64 222 Q66 198 68 172 Z" />
            {/* Feet */}
            <ellipse cx="52" cy="242" rx="9" ry="5" />
            <ellipse cx="68" cy="242" rx="9" ry="5" />
        </g>
    );
}

/** Human body silhouette – back view. */
function BackSilhouette() {
    return (
        <g fill="currentColor" className="text-slate-600 dark:text-slate-500" fillOpacity="0.9">
            <ellipse cx="60" cy="20" rx="13" ry="16" />
            <path d="M52 36 Q60 34 68 36 L66 48 Q60 50 54 48 Z" />
            {/* Upper back & torso */}
            <path d="M30 50 Q28 52 30 55 L32 90 Q34 112 36 122 L38 128 Q60 130 82 128 L84 122 Q86 112 88 90 L90 55 Q92 52 90 50 Q75 46 60 48 Q45 46 30 50 Z" />
            {/* Left arm (back) */}
            <path d="M30 50 Q22 55 18 72 Q16 95 20 118 L24 125 Q28 122 26 98 Q28 72 32 58 Z" />
            {/* Right arm (back) */}
            <path d="M90 50 Q98 55 102 72 Q104 95 100 118 L96 125 Q92 122 94 98 Q92 72 88 58 Z" />
            {/* Lower back & glutes */}
            <path d="M38 128 Q42 135 60 136 Q78 135 82 128 L84 152 Q82 156 60 156 Q38 156 36 152 Z" />
            {/* Left leg */}
            <path d="M36 152 Q34 158 36 178 Q38 198 40 218 L46 232 Q50 236 54 232 L56 222 Q54 198 52 172 Z" />
            {/* Right leg */}
            <path d="M84 152 Q86 158 84 178 Q82 198 80 218 L74 232 Q70 236 66 232 L64 222 Q66 198 68 172 Z" />
            {/* Feet */}
            <ellipse cx="52" cy="242" rx="9" ry="5" />
            <ellipse cx="68" cy="242" rx="9" ry="5" />
        </g>
    );
}

export function BodyMap({ selectedMuscleSlug, onSelectMuscleSlug }: BodyMapProps) {
    const [view, setView] = useState<BodyView>('front');

    const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;

    const handleRegionClick = (region: BodyRegionConfig) => {
        if (region.muscleSlug === selectedMuscleSlug) {
            onSelectMuscleSlug('');
        } else {
            onSelectMuscleSlug(region.muscleSlug);
        }
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Body map
                </h2>
                <div className="inline-flex rounded-full border border-slate-300 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                    {(['front', 'back'] as BodyView[]).map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setView(v)}
                            className={`px-2 py-1 rounded-full ${
                                view === v
                                    ? 'bg-amber-500 text-black dark:bg-amber-400 dark:text-black'
                                    : 'text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-300'
                            }`}
                        >
                            {viewLabel[v]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-4 items-stretch">
                <div className="flex-1 max-w-xs">
                    <svg
                        viewBox="0 0 120 260"
                        role="img"
                        aria-label={`${viewLabel[view]} body view`}
                        className="h-64 w-full"
                    >
                        {/* Human body silhouette */}
                        {view === 'front' ? <FrontSilhouette /> : <BackSilhouette />}

                        {/* Overlay clickable regions */}
                        {view === 'front' && (
                            <g>
                                {/* chest */}
                                <RegionRect
                                    x={42}
                                    y={55}
                                    width={36}
                                    height={20}
                                    label="Chest"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-chest')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-chest')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* shoulders */}
                                <RegionRect
                                    x={32}
                                    y={48}
                                    width={56}
                                    height={14}
                                    label="Shoulders"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-shoulders')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-shoulders')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* biceps */}
                                <RegionRect
                                    x={22}
                                    y={70}
                                    width={18}
                                    height={24}
                                    label="Biceps / arms"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-biceps')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-biceps')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={80}
                                    y={70}
                                    width={18}
                                    height={24}
                                    label="Biceps / arms"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-biceps')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-biceps')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* forearms */}
                                <RegionRect
                                    x={22}
                                    y={94}
                                    width={18}
                                    height={26}
                                    label="Forearms"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-forearms')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-forearms')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={80}
                                    y={94}
                                    width={18}
                                    height={26}
                                    label="Forearms"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-forearms')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-forearms')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* core */}
                                <RegionRect
                                    x={44}
                                    y={75}
                                    width={32}
                                    height={35}
                                    label="Core"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-core')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-core')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* quads */}
                                <RegionRect
                                    x={44}
                                    y={125}
                                    width={12}
                                    height={45}
                                    label="Quads"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-quads')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-quads')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={64}
                                    y={125}
                                    width={12}
                                    height={45}
                                    label="Quads"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-quads')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-quads')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* calves */}
                                <RegionRect
                                    x={44}
                                    y={170}
                                    width={12}
                                    height={40}
                                    label="Calves"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-calves')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-calves')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={64}
                                    y={170}
                                    width={12}
                                    height={40}
                                    label="Calves"
                                    region={FRONT_REGIONS.find(r => r.id === 'front-calves')!}
                                    selected={regionIsSelected(
                                        FRONT_REGIONS.find(r => r.id === 'front-calves')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                            </g>
                        )}

                        {view === 'back' && (
                            <g>
                                {/* upper back */}
                                <RegionRect
                                    x={42}
                                    y={55}
                                    width={36}
                                    height={22}
                                    label="Upper back"
                                    region={BACK_REGIONS.find(r => r.id === 'back-upper-back')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-upper-back')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* lats */}
                                <RegionRect
                                    x={38}
                                    y={77}
                                    width={44}
                                    height={26}
                                    label="Lats"
                                    region={BACK_REGIONS.find(r => r.id === 'back-lats')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-lats')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* shoulders (back) */}
                                <RegionRect
                                    x={32}
                                    y={48}
                                    width={56}
                                    height={14}
                                    label="Shoulders"
                                    region={BACK_REGIONS.find(r => r.id === 'back-shoulders')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-shoulders')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* triceps */}
                                <RegionRect
                                    x={22}
                                    y={72}
                                    width={18}
                                    height={24}
                                    label="Triceps"
                                    region={BACK_REGIONS.find(r => r.id === 'back-triceps')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-triceps')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={80}
                                    y={72}
                                    width={18}
                                    height={24}
                                    label="Triceps"
                                    region={BACK_REGIONS.find(r => r.id === 'back-triceps')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-triceps')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* glutes */}
                                <RegionRect
                                    x={44}
                                    y={110}
                                    width={32}
                                    height={25}
                                    label="Glutes"
                                    region={BACK_REGIONS.find(r => r.id === 'back-glutes')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-glutes')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* hamstrings */}
                                <RegionRect
                                    x={44}
                                    y={135}
                                    width={12}
                                    height={35}
                                    label="Hamstrings"
                                    region={BACK_REGIONS.find(r => r.id === 'back-hamstrings')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-hamstrings')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={64}
                                    y={135}
                                    width={12}
                                    height={35}
                                    label="Hamstrings"
                                    region={BACK_REGIONS.find(r => r.id === 'back-hamstrings')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-hamstrings')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                {/* calves (back) */}
                                <RegionRect
                                    x={44}
                                    y={170}
                                    width={12}
                                    height={40}
                                    label="Calves"
                                    region={BACK_REGIONS.find(r => r.id === 'back-calves')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-calves')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                                <RegionRect
                                    x={64}
                                    y={170}
                                    width={12}
                                    height={40}
                                    label="Calves"
                                    region={BACK_REGIONS.find(r => r.id === 'back-calves')!}
                                    selected={regionIsSelected(
                                        BACK_REGIONS.find(r => r.id === 'back-calves')!,
                                        selectedMuscleSlug
                                    )}
                                    onClick={handleRegionClick}
                                />
                            </g>
                        )}
                    </svg>
                </div>

                {/* Legend for clarity */}
                <div className="flex-1 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Click a region to filter exercises by muscle group.
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                        {regions.map(region => (
                            <li key={region.id}>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRegionClick(region)}
                                        className={`underline-offset-2 ${
                                            regionIsSelected(region, selectedMuscleSlug)
                                                ? 'text-amber-600 dark:text-amber-400 underline'
                                                : 'hover:text-amber-600 dark:hover:text-amber-300'
                                        }`}
                                    >
                                        {region.label}
                                    </button>
                                    <Link
                                        href={`/fitness/muscles/${encodeURIComponent(region.muscleSlug)}`}
                                        className="text-[11px] text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300 underline-offset-2 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Muscle page
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

type RegionRectProps = {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    region: BodyRegionConfig;
    selected: boolean;
    onClick: (region: BodyRegionConfig) => void;
};

function RegionRect({ x, y, width, height, label, region, selected, onClick }: RegionRectProps) {
    const [hover, setHover] = useState(false);
    const baseFill = selected ? '#f59e0b' : '#94a3b8';
    const baseOpacity = selected ? 0.6 : hover ? 0.35 : 0.2;
    const strokeColor = selected ? '#f97316' : hover ? '#64748b' : 'transparent';
    const strokeWidth = selected ? 2 : hover ? 0.5 : 0;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={6}
                fill={baseFill}
                fillOpacity={baseOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className="cursor-pointer transition-opacity duration-150"
                onClick={() => onClick(region)}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            />
            <title>{label}</title>
        </g>
    );
}

