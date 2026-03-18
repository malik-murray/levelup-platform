-- Migration: Seed exercise catalog (muscle groups, equipment, exercises)
-- Idempotent: ON CONFLICT (slug) DO NOTHING for re-runs.
-- Run after 036_exercise_database.sql.

-- =============================================================================
-- 1. MUSCLE GROUPS
-- =============================================================================
INSERT INTO muscle_groups (name, slug, region)
VALUES
    ('Chest', 'chest', 'upper'),
    ('Upper Back', 'upper-back', 'upper'),
    ('Lats', 'lats', 'upper'),
    ('Shoulders', 'shoulders', 'upper'),
    ('Biceps', 'biceps', 'upper'),
    ('Triceps', 'triceps', 'upper'),
    ('Forearms', 'forearms', 'upper'),
    ('Core', 'core', 'core'),
    ('Glutes', 'glutes', 'lower'),
    ('Quads', 'quads', 'lower'),
    ('Hamstrings', 'hamstrings', 'lower'),
    ('Calves', 'calves', 'lower')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. EQUIPMENT
-- =============================================================================
INSERT INTO equipment (name, slug)
VALUES
    ('Bodyweight', 'bodyweight'),
    ('Dumbbell', 'dumbbell'),
    ('Barbell', 'barbell'),
    ('Kettlebell', 'kettlebell'),
    ('Cable', 'cable'),
    ('Machine', 'machine'),
    ('Resistance Band', 'resistance-band'),
    ('EZ Bar', 'ez-bar'),
    ('Medicine Ball', 'medicine-ball'),
    ('Pull-up Bar', 'pull-up-bar'),
    ('Jump Rope', 'jumprope')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. EXERCISES
-- FKs resolved via (SELECT id FROM muscle_groups WHERE slug = '...') and equipment.
-- =============================================================================
INSERT INTO exercises (
    slug, name, primary_muscle_group_id, secondary_muscle_group_ids, equipment_id,
    difficulty, movement_pattern, force_type, mechanic, short_description,
    instructions, tips, common_mistakes, media_url, thumbnail_url, is_published
)
VALUES
    -- CHEST (5)
    (
        'bench-press',
        'Bench Press',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('triceps','shoulders')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Classic horizontal press for chest, anterior delts, and triceps.',
        ARRAY[
            'Lie on bench with eyes under the bar. Grip slightly wider than shoulder width.',
            'Unrack and hold bar over chest with arms extended.',
            'Lower bar to mid-chest with control. Elbows roughly 45° from body.',
            'Press bar up to lockout. Repeat.'
        ],
        ARRAY['Retract shoulder blades before unracking.', 'Drive through the whole foot.', 'Keep glutes on the bench.'],
        ARRAY['Flaring elbows too wide', 'Bouncing bar off chest', 'Lifting head or hips'],
        NULL, NULL, true
    ),
    (
        'incline-dumbbell-press',
        'Incline Dumbbell Press',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders','triceps')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Incline press emphasizing upper chest and front delts.',
        ARRAY[
            'Set bench to 30–45°. Sit with back flat, feet on floor.',
            'Hold dumbbells at shoulder height, palms forward.',
            'Press dumbbells up until arms are extended, not locked.',
            'Lower with control to start. Repeat.'
        ],
        ARRAY['Slight incline is enough for upper chest.', 'Keep wrists straight.', 'Squeeze at the top.'],
        ARRAY['Going too heavy and losing control', 'Excessive incline', 'Not lowering fully'],
        NULL, NULL, true
    ),
    (
        'push-up',
        'Push-Up',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('triceps','shoulders','core')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', 'push', 'push', 'compound',
        'Bodyweight horizontal push for chest, triceps, and core.',
        ARRAY[
            'Start in plank: hands under shoulders, body straight.',
            'Lower chest toward floor by bending elbows (about 45° from body).',
            'Push back up to full lockout. Keep core braced throughout.'
        ],
        ARRAY['Keep a straight line from head to heels.', 'Modify on knees if needed.', 'Touch chest or nose to floor.'],
        ARRAY['Sagging hips', 'Piking hips up', 'Flaring elbows out too wide'],
        NULL, NULL, true
    ),
    (
        'cable-fly',
        'Cable Fly',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Isolation chest fly with constant tension from the cable.',
        ARRAY[
            'Set pulleys at or above shoulder height. Stand between them, one foot slightly forward.',
            'Grip handles and bring hands together in front of chest with slight bend in elbows.',
            'Open arms out to the sides until stretch in chest. Control the return.'
        ],
        ARRAY['Keep a fixed elbow angle.', 'Squeeze chest at the center.', 'Use a slight forward lean.'],
        ARRAY['Using too much weight and swinging', 'Straightening arms', 'Shrugging shoulders'],
        NULL, NULL, true
    ),
    (
        'incline-barbell-bench-press',
        'Incline Barbell Bench Press',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders','triceps')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Incline barbell press for upper chest and front delts.',
        ARRAY[
            'Set bench to 30–45°. Lie with eyes under bar. Grip shoulder-width or slightly wider.',
            'Unrack and hold bar over upper chest.',
            'Lower bar to upper chest. Press up to lockout.'
        ],
        ARRAY['Retract scapula. Use a spotter when going heavy.', 'Drive through feet.'],
        ARRAY['Bar too low on chest', 'Elbows flared 90°', 'Losing upper back tightness'],
        NULL, NULL, true
    ),
    -- BACK (6)
    (
        'lat-pulldown',
        'Lat Pulldown',
        (SELECT id FROM muscle_groups WHERE slug = 'lats' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back','biceps')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'pull', 'pull', 'compound',
        'Vertical pull for lats and upper back, often on a cable machine.',
        ARRAY[
            'Sit and secure thighs. Grip bar wide (or use close grip). Slight lean back.',
            'Pull bar down to upper chest or collarbone. Squeeze lats.',
            'Return with control to full stretch. Repeat.'
        ],
        ARRAY['Lead with elbows, not hands.', 'Avoid excessive lean or swing.', 'Full stretch at top.'],
        ARRAY['Pulling behind neck (risk to shoulders)', 'Using momentum', 'Not achieving full range'],
        NULL, NULL, true
    ),
    (
        'pull-up',
        'Pull-Up',
        (SELECT id FROM muscle_groups WHERE slug = 'lats' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back','biceps','core')),
        (SELECT id FROM equipment WHERE slug = 'pull-up-bar' LIMIT 1),
        'intermediate', 'pull', 'pull', 'compound',
        'Bodyweight vertical pull for lats, upper back, and biceps.',
        ARRAY[
            'Hang from bar with hands shoulder-width or wider, palms away.',
            'Pull yourself up until chin clears bar. Lower with control to full hang.'
        ],
        ARRAY['Start from dead hang for full range.', 'Use band or assist machine to progress.', 'Keep core tight.'],
        ARRAY['Kipping before building strength', 'Partial range', 'Shrugging at the top'],
        NULL, NULL, true
    ),
    (
        'seated-cable-row',
        'Seated Cable Row',
        (SELECT id FROM muscle_groups WHERE slug = 'upper-back' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats','biceps')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'pull', 'pull', 'compound',
        'Horizontal row for mid-back, lats, and biceps.',
        ARRAY[
            'Sit at cable with feet on platform. Slight bend in knees. Hold handle(s).',
            'Sit tall, chest up. Pull handle to lower chest/upper abs. Squeeze shoulder blades.',
            'Return with control. Repeat.'
        ],
        ARRAY['Do not round lower back.', 'Pull to belly, not chest, for more lats.', 'Use V-bar or straight bar.'],
        ARRAY['Rounding back', 'Using body swing', 'Shrugging shoulders'],
        NULL, NULL, true
    ),
    (
        'barbell-row',
        'Barbell Row',
        (SELECT id FROM muscle_groups WHERE slug = 'upper-back' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats','biceps','forearms')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'pull', 'pull', 'compound',
        'Bent-over horizontal row for back and biceps.',
        ARRAY[
            'Hinge at hips, knees slightly bent. Hold bar with hands just outside legs.',
            'Pull bar to lower chest/upper stomach. Elbows drive back.',
            'Lower with control. Keep torso stable.'
        ],
        ARRAY['Keep back flat, not rounded.', 'Neutral neck.', 'Brace core.'],
        ARRAY['Rounding lower back', 'Pulling to belly only', 'Excessive body English'],
        NULL, NULL, true
    ),
    (
        'deadlift',
        'Deadlift',
        (SELECT id FROM muscle_groups WHERE slug = 'hamstrings' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back','glutes','core','forearms')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'advanced', 'hinge', 'pull', 'compound',
        'Full-body hinge: hamstrings, glutes, back, and core.',
        ARRAY[
            'Stand with bar over mid-foot. Hinge and grip bar outside legs.',
            'Set back flat, chest up. Drive through whole foot and extend hips and knees.',
            'Stand tall. Lower by hinging and bending knees. Control the bar.'
        ],
        ARRAY['Bar stays close to body.', 'Brace core and lock lats.', 'Do not round lower back.'],
        ARRAY['Rounding lower back', 'Bar drifting forward', 'Hyperextending at lockout'],
        NULL, NULL, true
    ),
    (
        'face-pull',
        'Face Pull',
        (SELECT id FROM muscle_groups WHERE slug = 'upper-back' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders','biceps')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'pull', 'pull', 'compound',
        'Horizontal pull to the face for rear delts and upper back.',
        ARRAY[
            'Set cable at face height. Grip rope or handles. Step back for tension.',
            'Pull hands to ears. Externally rotate at end so thumbs point back.',
            'Return with control. Repeat.'
        ],
        ARRAY['Squeeze rear delts and upper back.', 'Keep elbows high.', 'Use light weight for form.'],
        ARRAY['Pulling too low', 'Using too much weight', 'No external rotation'],
        NULL, NULL, true
    ),
    -- SHOULDERS (5)
    (
        'overhead-press',
        'Overhead Press',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('triceps','core')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Standing or seated vertical press for shoulders and triceps.',
        ARRAY[
            'Hold bar at front-rack (front delts). Stand with feet about hip width.',
            'Brace core. Press bar up in a slight arc. Lock out overhead.',
            'Lower with control to front rack. Repeat.'
        ],
        ARRAY['Keep ribs down to protect lower back.', 'Bar travels in a straight line.', 'Full lockout.'],
        ARRAY['Excessive back arch', 'Pushing bar forward', 'Partial lockout'],
        NULL, NULL, true
    ),
    (
        'lateral-raise',
        'Lateral Raise',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('core')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Isolation lift for lateral (side) delts.',
        ARRAY[
            'Stand with dumbbells at sides, palms in. Slight bend in elbows.',
            'Raise arms out to the sides to shoulder height. Lower with control.'
        ],
        ARRAY['Lead with elbows, not hands.', 'Light weight for strict form.', 'Slight forward lean optional.'],
        ARRAY['Shrugging shoulders', 'Swinging weight', 'Raising too high'],
        NULL, NULL, true
    ),
    (
        'front-raise',
        'Front Raise',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Isolation for front delts.',
        ARRAY[
            'Stand with dumbbells in front of thighs, palms back.',
            'Raise one or both arms forward to shoulder height. Lower with control.'
        ],
        ARRAY['Keep core braced.', 'Control the weight.', 'Avoid swinging.'],
        ARRAY['Using momentum', 'Going past shoulder height', 'Rounding back'],
        NULL, NULL, true
    ),
    (
        'reverse-fly',
        'Reverse Fly',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Isolation for rear delts and upper back.',
        ARRAY[
            'Hinge at hips or sit on bench. Hold dumbbells, arms hanging.',
            'Raise arms out to the sides, squeezing rear delts. Lower with control.'
        ],
        ARRAY['Slight bend in elbows.', 'Lead with elbows.', 'Light weight.'],
        ARRAY['Using too much weight', 'Shrugging', 'Not hinging enough'],
        NULL, NULL, true
    ),
    (
        'arnold-press',
        'Arnold Press',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('triceps')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Rotating dumbbell press targeting all three delt heads.',
        ARRAY[
            'Start with dumbbells at shoulder height, palms toward face.',
            'Press up while rotating palms out. At top, palms face forward.',
            'Reverse the rotation on the way down. Repeat.'
        ],
        ARRAY['Control the rotation.', 'Keep elbows in front of body.', 'Full range.'],
        ARRAY['Rushing the rotation', 'Letting elbows flare', 'Going too heavy'],
        NULL, NULL, true
    ),
    -- BICEPS (5)
    (
        'dumbbell-curl',
        'Dumbbell Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'biceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('forearms')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Classic bicep curl with dumbbells.',
        ARRAY[
            'Stand with dumbbells at sides, palms forward. Elbows at sides.',
            'Curl weights toward shoulders. Squeeze biceps at top.',
            'Lower with control. Repeat.'
        ],
        ARRAY['Do not swing. Keep elbows fixed.', 'Full stretch at bottom.', 'Supinate at top optional.'],
        ARRAY['Swinging body', 'Elbows drifting forward', 'Partial range'],
        NULL, NULL, true
    ),
    (
        'hammer-curl',
        'Hammer Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'biceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('forearms')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Neutral-grip curl for biceps and brachialis.',
        ARRAY[
            'Hold dumbbells with palms facing in (neutral). Arms at sides.',
            'Curl toward shoulders. Keep palms in throughout.',
            'Lower with control. Repeat.'
        ],
        ARRAY['Elbows stay at sides.', 'Control the negative.', 'Brace core.'],
        ARRAY['Swinging', 'Rotating to standard curl', 'Moving elbows'],
        NULL, NULL, true
    ),
    (
        'barbell-curl',
        'Barbell Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'biceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('forearms')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Barbell curl for biceps and forearms.',
        ARRAY[
            'Stand with barbell at arms length, palms forward. Elbows at sides.',
            'Curl bar toward shoulders. Lower with control.'
        ],
        ARRAY['Avoid swinging. Use EZ-bar to reduce wrist stress if needed.', 'Full range.'],
        ARRAY['Using momentum', 'Elbows drifting', 'Incomplete extension'],
        NULL, NULL, true
    ),
    (
        'cable-curl',
        'Cable Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'biceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('forearms')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Bicep curl with constant tension from cable.',
        ARRAY[
            'Stand at low cable. Grip bar or handle. Elbows at sides.',
            'Curl toward shoulders. Squeeze at top. Lower with control.'
        ],
        ARRAY['Constant tension throughout.', 'Stagger stance if needed.', 'Control the weight.'],
        ARRAY['Leaning back', 'Pulling with body', 'Partial reps'],
        NULL, NULL, true
    ),
    (
        'preacher-curl',
        'Preacher Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'biceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('forearms')),
        (SELECT id FROM equipment WHERE slug = 'ez-bar' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Supported curl isolating the biceps with EZ-bar or dumbbell.',
        ARRAY[
            'Sit at preacher bench. Rest arms on pad. Grip EZ-bar underhand.',
            'Curl bar up. Lower with control to full stretch.'
        ],
        ARRAY['Keep arms on pad.', 'Do not hyperextend at bottom.', 'Squeeze at top.'],
        ARRAY['Lifting elbows off pad', 'Bouncing at bottom', 'Using too much weight'],
        NULL, NULL, true
    ),
    -- TRICEPS (5)
    (
        'tricep-pushdown',
        'Tricep Pushdown',
        (SELECT id FROM muscle_groups WHERE slug = 'triceps' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Cable pushdown for triceps.',
        ARRAY[
            'Stand at high cable. Grip bar or rope. Elbows at sides.',
            'Push bar down by extending elbows. Squeeze at bottom.',
            'Return with control. Keep upper arms still.'
        ],
        ARRAY['Elbows stay fixed.', 'Do not lean over the bar.', 'Full extension.'],
        ARRAY['Moving elbows', 'Using body weight', 'Partial lockout'],
        NULL, NULL, true
    ),
    (
        'skull-crusher',
        'Skull Crusher',
        (SELECT id FROM muscle_groups WHERE slug = 'triceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('chest')),
        (SELECT id FROM equipment WHERE slug = 'ez-bar' LIMIT 1),
        'intermediate', 'push', 'push', 'isolation',
        'Lying tricep extension with EZ-bar or barbell.',
        ARRAY[
            'Lie on bench. Hold EZ-bar over chest, arms extended.',
            'Lower bar toward forehead or behind head by bending elbows.',
            'Extend arms back up. Repeat.'
        ],
        ARRAY['Keep upper arms vertical.', 'Control the weight.', 'Full stretch at bottom.'],
        ARRAY['Flaring elbows', 'Dropping bar too low', 'Using momentum'],
        NULL, NULL, true
    ),
    (
        'overhead-tricep-extension',
        'Overhead Tricep Extension',
        (SELECT id FROM muscle_groups WHERE slug = 'triceps' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Single or double dumbbell extension behind head for long head of triceps.',
        ARRAY[
            'Stand or sit. Hold one dumbbell with both hands. Arms overhead.',
            'Lower dumbbell behind head by bending elbows. Extend back up.'
        ],
        ARRAY['Keep upper arms by ears.', 'Control the weight.', 'Full stretch.'],
        ARRAY['Elbows drifting forward', 'Not going to full stretch', 'Swaying'],
        NULL, NULL, true
    ),
    (
        'close-grip-bench-press',
        'Close Grip Bench Press',
        (SELECT id FROM muscle_groups WHERE slug = 'triceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('chest','shoulders')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Bench press with narrow grip to emphasize triceps.',
        ARRAY[
            'Lie on bench. Grip bar with hands shoulder-width or closer.',
            'Unrack and lower to lower chest. Press up. Keep elbows tucked.'
        ],
        ARRAY['Elbows stay close to body.', 'Full lockout.', 'Control the descent.'],
        ARRAY['Flaring elbows', 'Grip too narrow (wrist pain)', 'Bouncing'],
        NULL, NULL, true
    ),
    (
        'dips',
        'Dips',
        (SELECT id FROM muscle_groups WHERE slug = 'triceps' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('chest','shoulders')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Bodyweight dip for triceps and lower chest.',
        ARRAY[
            'Support yourself on parallel bars. Arms straight. Slight forward lean for chest.',
            'Lower by bending elbows until shoulders at elbow height or slightly below.',
            'Push back up to lockout. Repeat.'
        ],
        ARRAY['Do not go too deep if it hurts shoulders.', 'Use assist machine to progress.', 'Keep core tight.'],
        ARRAY['Excessive depth (shoulder pain)', 'Swinging', 'Shrugging'],
        NULL, NULL, true
    ),
    -- CORE (6)
    (
        'plank',
        'Plank',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', 'anti_rotation', 'static', 'compound',
        'Isometric hold for core stability.',
        ARRAY[
            'Start in push-up position or on forearms. Body in straight line.',
            'Brace core. Hold position. Breathe steadily.'
        ],
        ARRAY['Do not let hips sag or pike.', 'Squeeze glutes.', 'Progress with time or variations.'],
        ARRAY['Sagging hips', 'Holding breath', 'Looking up'],
        NULL, NULL, true
    ),
    (
        'hanging-knee-raise',
        'Hanging Knee Raise',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats','forearms')),
        (SELECT id FROM equipment WHERE slug = 'pull-up-bar' LIMIT 1),
        'intermediate', 'pull', 'pull', 'compound',
        'Hanging leg raise variation for lower core and hip flexors.',
        ARRAY[
            'Hang from bar. Engage core. Avoid swinging.',
            'Raise knees toward chest. Lower with control. Repeat.'
        ],
        ARRAY['Control the swing.', 'Lead with knees, not momentum.', 'Full hang at bottom.'],
        ARRAY['Swinging', 'Using arms to pull', 'Partial range'],
        NULL, NULL, true
    ),
    (
        'dead-bug',
        'Dead Bug',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', 'anti_rotation', 'static', 'compound',
        'Supine core exercise opposing arm and leg movement.',
        ARRAY[
            'Lie on back. Arms up. Knees bent 90°. Lower back pressed to floor.',
            'Extend one arm and opposite leg. Return. Alternate sides.'
        ],
        ARRAY['Keep lower back flat.', 'Exhale on effort.', 'Move slowly.'],
        ARRAY['Arching lower back', 'Moving too fast', 'Holding breath'],
        NULL, NULL, true
    ),
    (
        'cable-woodchop',
        'Cable Woodchop',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders')),
        (SELECT id FROM equipment WHERE slug = 'cable' LIMIT 1),
        'beginner', 'rotation', 'pull', 'compound',
        'Rotational cable exercise for obliques and core.',
        ARRAY[
            'Set cable high or low. Stand sideways. Hold handle with both hands.',
            'Rotate torso and pull handle across body. Return with control. Switch sides.'
        ],
        ARRAY['Pivot on back foot.', 'Keep arms relatively straight.', 'Control the rotation.'],
        ARRAY['Using only arms', 'Twisting lower back excessively', 'Too much weight'],
        NULL, NULL, true
    ),
    (
        'bicycle-crunch',
        'Bicycle Crunch',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', 'rotation', 'pull', 'compound',
        'Dynamic crunch with alternating elbow-to-knee motion.',
        ARRAY[
            'Lie on back. Hands behind head. Bring one knee in and opposite elbow toward it.',
            'Switch: extend that leg and bring other knee in with opposite elbow. Pedal smoothly.'
        ],
        ARRAY['Do not pull on neck.', 'Exhale as you crunch.', 'Controlled motion.'],
        ARRAY['Pulling head with hands', 'Going too fast', 'Arching neck'],
        NULL, NULL, true
    ),
    (
        'ab-wheel-rollout',
        'Ab Wheel Rollout',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'intermediate', 'push', 'push', 'compound',
        'Rollout for core and anterior stability.',
        ARRAY[
            'Kneel with ab wheel in hands. Brace core.',
            'Roll forward until body is extended. Pull back to start.'
        ],
        ARRAY['Do not extend past ability to return.', 'Keep core braced.', 'Progress range gradually.'],
        ARRAY['Extending too far and failing', 'Sagging hips', 'Not bracing'],
        NULL, NULL, true
    ),
    -- LOWER: QUADS / GLUTES / HAMSTRINGS (8)
    (
        'back-squat',
        'Back Squat',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes','hamstrings','core')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'advanced', 'squat', 'push', 'compound',
        'Barbell squat for quads, glutes, and core.',
        ARRAY[
            'Bar on upper back. Feet shoulder-width or wider. Toes slightly out.',
            'Brace core. Squat down until thighs at or below parallel.',
            'Drive up through whole foot. Stand to lockout.'
        ],
        ARRAY['Keep chest up and back tight.', 'Knees track over toes.', 'Control the descent.'],
        ARRAY['Rounding lower back', 'Knees caving', 'Heels rising'],
        NULL, NULL, true
    ),
    (
        'romanian-deadlift',
        'Romanian Deadlift',
        (SELECT id FROM muscle_groups WHERE slug = 'hamstrings' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes','upper-back','core')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'hinge', 'pull', 'compound',
        'Hinge for hamstrings and glutes with slight knee bend.',
        ARRAY[
            'Stand with bar at thighs. Hinge at hips. Bar slides down legs.',
            'Lower until stretch in hamstrings. Drive hips forward to stand.'
        ],
        ARRAY['Keep back flat. Slight knee bend.', 'Bar stays close.'],
        ARRAY['Rounding back', 'Bending knees too much', 'Bar drifting forward'],
        NULL, NULL, true
    ),
    (
        'walking-lunge',
        'Walking Lunge',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes','hamstrings','core')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', 'lunge', 'push', 'compound',
        'Alternating forward lunge for quads and glutes.',
        ARRAY[
            'Stand tall. Step forward into a lunge. Back knee toward floor.',
            'Drive through front foot to step through to next lunge. Alternate.'
        ],
        ARRAY['Keep torso upright.', 'Front knee over ankle.', 'Controlled step.'],
        ARRAY['Knee caving', 'Stride too short or long', 'Leaning forward'],
        NULL, NULL, true
    ),
    (
        'hip-thrust',
        'Hip Thrust',
        (SELECT id FROM muscle_groups WHERE slug = 'glutes' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('hamstrings','core')),
        (SELECT id FROM equipment WHERE slug = 'barbell' LIMIT 1),
        'intermediate', 'hinge', 'push', 'compound',
        'Hip extension for glutes and hamstrings.',
        ARRAY[
            'Upper back on bench. Bar over hips. Feet flat, knees bent.',
            'Drive through heels and extend hips to lockout. Squeeze glutes.',
            'Lower with control. Repeat.'
        ],
        ARRAY['Chin tucked. Full extension at top.', 'Bar over crease of hip.'],
        ARRAY['Hyperextending lower back', 'Not squeezing glutes', 'Feet too far forward'],
        NULL, NULL, true
    ),
    (
        'leg-press',
        'Leg Press',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes','hamstrings')),
        (SELECT id FROM equipment WHERE slug = 'machine' LIMIT 1),
        'beginner', 'squat', 'push', 'compound',
        'Machine leg press for quads and glutes.',
        ARRAY[
            'Sit in machine. Feet on platform. Release safety.',
            'Lower until knees bend to about 90°. Press back to start.'
        ],
        ARRAY['Do not lock knees at top.', 'Feet placement changes emphasis.', 'Full range.'],
        ARRAY['Lower back rounding', 'Locking knees', 'Too much depth (butt wink)'],
        NULL, NULL, true
    ),
    (
        'leg-curl',
        'Leg Curl',
        (SELECT id FROM muscle_groups WHERE slug = 'hamstrings' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'machine' LIMIT 1),
        'beginner', 'pull', 'pull', 'isolation',
        'Machine curl for hamstrings (lying or seated).',
        ARRAY[
            'Position in machine. Pad on back of lower legs.',
            'Curl heels toward glutes. Lower with control.'
        ],
        ARRAY['Do not lift hips.', 'Full range.', 'Control the weight.'],
        ARRAY['Hips coming up', 'Using momentum', 'Partial range'],
        NULL, NULL, true
    ),
    (
        'goblet-squat',
        'Goblet Squat',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('core','glutes')),
        (SELECT id FROM equipment WHERE slug = 'kettlebell' LIMIT 1),
        'beginner', 'squat', 'push', 'compound',
        'Front-loaded squat with kettlebell or dumbbell.',
        ARRAY[
            'Hold weight at chest. Feet shoulder-width. Squat down.',
            'Keep weight at chest. Drive up to stand.'
        ],
        ARRAY['Elbows inside knees.', 'Upright torso.', 'Good for learning squat pattern.'],
        ARRAY['Leaning forward', 'Weight pulling you down', 'Knees caving'],
        NULL, NULL, true
    ),
    (
        'bulgarian-split-squat',
        'Bulgarian Split Squat',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes','hamstrings','core')),
        (SELECT id FROM equipment WHERE slug = 'dumbbell' LIMIT 1),
        'intermediate', 'lunge', 'push', 'compound',
        'Single-leg squat with rear foot elevated.',
        ARRAY[
            'Stand with one foot behind on bench. Hold dumbbells.',
            'Lower until front thigh near parallel. Drive up. Repeat. Switch legs.'
        ],
        ARRAY['Front knee over ankle.', 'Upright torso.', 'Balance with light weight first.'],
        ARRAY['Front knee caving', 'Leaning forward', 'Rear foot too close'],
        NULL, NULL, true
    ),
    -- CALVES (2)
    (
        'standing-calf-raise',
        'Standing Calf Raise',
        (SELECT id FROM muscle_groups WHERE slug = 'calves' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'machine' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Standing calf raise for gastrocnemius.',
        ARRAY[
            'Stand on platform. Balls of feet on edge. Lower heels for stretch.',
            'Raise onto toes. Squeeze at top. Lower with control.'
        ],
        ARRAY['Full range: deep stretch to full raise.', 'Control the negative.', 'Use machine or bodyweight.'],
        ARRAY['Partial range', 'Bouncing', 'Bending knees'],
        NULL, NULL, true
    ),
    (
        'seated-calf-raise',
        'Seated Calf Raise',
        (SELECT id FROM muscle_groups WHERE slug = 'calves' LIMIT 1),
        ARRAY[]::UUID[],
        (SELECT id FROM equipment WHERE slug = 'machine' LIMIT 1),
        'beginner', 'push', 'push', 'isolation',
        'Seated calf raise for soleus.',
        ARRAY[
            'Sit in machine. Balls of feet on platform. Lower heels.',
            'Raise onto toes. Lower with control. Repeat.'
        ],
        ARRAY['Knees bent targets soleus.', 'Full stretch at bottom.', 'Control the weight.'],
        ARRAY['Bouncing', 'Partial range', 'Too much weight'],
        NULL, NULL, true
    )
ON CONFLICT (slug) DO NOTHING;
