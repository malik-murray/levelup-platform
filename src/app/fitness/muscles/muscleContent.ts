export type MuscleContent = {
    slug: string;
    label: string;
    description: string;
    trainingFocus: string;
    beginnerTip: string;
    commonPatterns: string[];
    foundationalExerciseSlugs: string[];
    relatedMuscleSlugs: string[];
};

export const MUSCLE_CONTENT: Record<string, MuscleContent> = {
    chest: {
        slug: 'chest',
        label: 'Chest',
        description:
            'The chest drives most horizontal and incline pressing, contributing to pushing strength and upper-body size.',
        trainingFocus:
            'Emphasize controlled horizontal and incline presses with stable shoulders and full range of motion.',
        beginnerTip:
            'Start with push-ups and light dumbbell presses before loading heavy barbells; focus on smooth reps, not max weight.',
        commonPatterns: ['Horizontal press', 'Incline press', 'Push patterns', 'Tempo work (controlled lowering)'],
        foundationalExerciseSlugs: ['bench-press', 'incline-dumbbell-press', 'push-up', 'cable-fly'],
        relatedMuscleSlugs: ['shoulders', 'triceps', 'core'],
    },
    'upper-back': {
        slug: 'upper-back',
        label: 'Upper Back',
        description:
            'The upper back stabilizes the shoulder girdle and supports rowing, pulling, and good posture.',
        trainingFocus:
            'Prioritize horizontal rows and rear-delt focused work to build stability and resilience for pressing and pulling.',
        beginnerTip:
            'Use chest-supported and cable rows to learn proper scapular retraction before progressing to heavy barbell rows.',
        commonPatterns: ['Horizontal row', 'Scapular retraction', 'Face pulls', 'Posture work'],
        foundationalExerciseSlugs: ['seated-cable-row', 'barbell-row', 'face-pull'],
        relatedMuscleSlugs: ['lats', 'shoulders', 'core'],
    },
    lats: {
        slug: 'lats',
        label: 'Lats',
        description:
            'The lats drive vertical and diagonal pulling, contributing to back width and shoulder extension strength.',
        trainingFocus:
            'Combine vertical pulls (pulldowns, pull-ups) with rows that allow you to feel the lats lengthen and contract.',
        beginnerTip:
            'Focus on slow, controlled pulldowns and rows; think about driving elbows down and back rather than pulling with the hands.',
        commonPatterns: ['Vertical pull', 'Diagonal pull', 'Row variations', 'Shoulder extension'],
        foundationalExerciseSlugs: ['lat-pulldown', 'pull-up', 'seated-cable-row'],
        relatedMuscleSlugs: ['upper-back', 'biceps', 'core'],
    },
    shoulders: {
        slug: 'shoulders',
        label: 'Shoulders',
        description:
            'The shoulders (delts) support nearly every upper-body movement and control overhead and lateral arm positions.',
        trainingFocus:
            'Use a mix of overhead presses and isolation raises to cover front, side, and rear delts without overloading the joints.',
        beginnerTip:
            'Start with light dumbbell presses and lateral raises, keeping reps smooth and pain-free; avoid grinding overhead sets.',
        commonPatterns: ['Vertical press', 'Lateral raise', 'Front raise', 'Rear-delt work'],
        foundationalExerciseSlugs: ['overhead-press', 'lateral-raise', 'reverse-fly', 'arnold-press'],
        relatedMuscleSlugs: ['chest', 'triceps', 'upper-back'],
    },
    biceps: {
        slug: 'biceps',
        label: 'Biceps',
        description:
            'The biceps flex the elbow and assist in pulling movements, adding arm size and grip support.',
        trainingFocus:
            'Use a variety of curls (supinated, neutral, preacher) for different angles while keeping elbows mostly fixed.',
        beginnerTip:
            'Keep weight light enough to avoid swinging; focus on full elbow extension and controlled curls.',
        commonPatterns: ['Elbow flexion', 'Supinated curls', 'Hammer curls'],
        foundationalExerciseSlugs: ['dumbbell-curl', 'hammer-curl', 'barbell-curl', 'preacher-curl'],
        relatedMuscleSlugs: ['forearms', 'lats', 'upper-back'],
    },
    triceps: {
        slug: 'triceps',
        label: 'Triceps',
        description:
            'The triceps extend the elbow and are key for pressing strength and upper-arm size.',
        trainingFocus:
            'Blend heavy compound presses with isolation work that loads the triceps in both stretched and locked-out positions.',
        beginnerTip:
            'Use cable pushdowns and moderate-rep close-grip presses before chasing heavy skull crushers.',
        commonPatterns: ['Elbow extension', 'Lockout strength', 'Overhead tricep work'],
        foundationalExerciseSlugs: ['tricep-pushdown', 'close-grip-bench-press', 'skull-crusher', 'overhead-tricep-extension'],
        relatedMuscleSlugs: ['chest', 'shoulders'],
    },
    forearms: {
        slug: 'forearms',
        label: 'Forearms',
        description:
            'The forearms control grip strength and wrist position, supporting nearly all pulling and many pressing movements.',
        trainingFocus:
            'Use carries, curls, and hangs to challenge grip in different positions without overtaxing the elbows.',
        beginnerTip:
            'Let forearm strength build gradually from rows, deadlifts, and carries; add dedicated grip work sparingly at first.',
        commonPatterns: ['Grip holds', 'Carries', 'Hammer curls'],
        foundationalExerciseSlugs: ['hammer-curl', 'deadlift'],
        relatedMuscleSlugs: ['biceps', 'lats'],
    },
    core: {
        slug: 'core',
        label: 'Core',
        description:
            'The core stabilizes the spine and transfers force between upper and lower body in nearly every movement.',
        trainingFocus:
            'Prioritize anti-extension and anti-rotation work alongside basic flexion to build a strong, resilient midsection.',
        beginnerTip:
            'Focus on quality planks and dead bugs before adding aggressive flexion or loaded rotation.',
        commonPatterns: ['Anti-extension', 'Anti-rotation', 'Rotation', 'Static holds'],
        foundationalExerciseSlugs: ['plank', 'dead-bug', 'cable-woodchop', 'hanging-knee-raise'],
        relatedMuscleSlugs: ['glutes', 'upper-back', 'quads', 'hamstrings'],
    },
    glutes: {
        slug: 'glutes',
        label: 'Glutes',
        description:
            'The glutes drive hip extension and stabilize the pelvis, essential for powerful and safe lower-body training.',
        trainingFocus:
            'Use a mix of squats, hip hinges, and hip thrust patterns to load the glutes through full range and in different angles.',
        beginnerTip:
            'Learn to feel the glutes in bodyweight bridges and goblet squats before adding heavy hip thrusts or deadlifts.',
        commonPatterns: ['Hip extension', 'Squat patterns', 'Hinge patterns'],
        foundationalExerciseSlugs: ['hip-thrust', 'back-squat', 'romanian-deadlift', 'goblet-squat'],
        relatedMuscleSlugs: ['hamstrings', 'quads', 'core'],
    },
    quads: {
        slug: 'quads',
        label: 'Quads',
        description:
            'The quads extend the knee and are primary movers in squat and lunge variations.',
        trainingFocus:
            'Emphasize knee-dominant patterns like squats, split squats, and leg presses with controlled depth.',
        beginnerTip:
            'Start with goblet squats and simple split squats to own your range of motion before loading heavy back squats.',
        commonPatterns: ['Squat patterns', 'Lunge patterns', 'Leg press'],
        foundationalExerciseSlugs: ['back-squat', 'goblet-squat', 'leg-press', 'bulgarian-split-squat'],
        relatedMuscleSlugs: ['glutes', 'hamstrings', 'calves'],
    },
    hamstrings: {
        slug: 'hamstrings',
        label: 'Hamstrings',
        description:
            'The hamstrings extend the hip and flex the knee, supporting sprinting, hinging, and knee health.',
        trainingFocus:
            'Blend hinge variations and knee-flexion work to train the hamstrings at different lengths and angles.',
        beginnerTip:
            'Use light Romanian deadlifts and machine leg curls to learn proper tension without straining the lower back.',
        commonPatterns: ['Hip hinge', 'Leg curl', 'Posterior chain work'],
        foundationalExerciseSlugs: ['romanian-deadlift', 'leg-curl', 'deadlift'],
        relatedMuscleSlugs: ['glutes', 'calves', 'core'],
    },
    calves: {
        slug: 'calves',
        label: 'Calves',
        description:
            'The calves support ankle stability and propulsion in walking, running, and jumping.',
        trainingFocus:
            'Train both straight-leg and bent-knee calf raises with full stretch and full contraction.',
        beginnerTip:
            'Start with slow, controlled bodyweight calf raises before loading machines or heavy dumbbells.',
        commonPatterns: ['Plantar flexion', 'Standing calf raises', 'Seated calf raises'],
        foundationalExerciseSlugs: ['standing-calf-raise', 'seated-calf-raise'],
        relatedMuscleSlugs: ['hamstrings', 'quads'],
    },
};

