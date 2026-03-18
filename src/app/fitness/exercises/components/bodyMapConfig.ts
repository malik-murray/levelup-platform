export type BodyView = 'front' | 'back';

export type BodyRegionId =
    | 'front-chest'
    | 'front-shoulders'
    | 'front-biceps'
    | 'front-forearms'
    | 'front-core'
    | 'front-quads'
    | 'front-calves'
    | 'back-upper-back'
    | 'back-lats'
    | 'back-shoulders'
    | 'back-triceps'
    | 'back-glutes'
    | 'back-hamstrings'
    | 'back-calves';

export interface BodyRegionConfig {
    id: BodyRegionId;
    label: string;
    muscleSlug: string;
    view: BodyView;
}

export const FRONT_REGIONS: BodyRegionConfig[] = [
    { id: 'front-chest', label: 'Chest', muscleSlug: 'chest', view: 'front' },
    { id: 'front-shoulders', label: 'Shoulders', muscleSlug: 'shoulders', view: 'front' },
    { id: 'front-biceps', label: 'Biceps', muscleSlug: 'biceps', view: 'front' },
    { id: 'front-forearms', label: 'Forearms', muscleSlug: 'forearms', view: 'front' },
    { id: 'front-core', label: 'Core', muscleSlug: 'core', view: 'front' },
    { id: 'front-quads', label: 'Quads', muscleSlug: 'quads', view: 'front' },
    { id: 'front-calves', label: 'Calves', muscleSlug: 'calves', view: 'front' },
];

export const BACK_REGIONS: BodyRegionConfig[] = [
    { id: 'back-upper-back', label: 'Upper back', muscleSlug: 'upper-back', view: 'back' },
    { id: 'back-lats', label: 'Lats', muscleSlug: 'lats', view: 'back' },
    { id: 'back-shoulders', label: 'Shoulders', muscleSlug: 'shoulders', view: 'back' },
    { id: 'back-triceps', label: 'Triceps', muscleSlug: 'triceps', view: 'back' },
    { id: 'back-glutes', label: 'Glutes', muscleSlug: 'glutes', view: 'back' },
    { id: 'back-hamstrings', label: 'Hamstrings', muscleSlug: 'hamstrings', view: 'back' },
    { id: 'back-calves', label: 'Calves', muscleSlug: 'calves', view: 'back' },
];

