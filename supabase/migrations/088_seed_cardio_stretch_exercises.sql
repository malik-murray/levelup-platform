-- Migration: Seed cardio and stretch/yoga exercises
-- Idempotent: ON CONFLICT (slug) DO NOTHING for re-runs.
-- Run after 087_exercise_category.sql.

INSERT INTO exercises (
    slug, name, primary_muscle_group_id, secondary_muscle_group_ids, equipment_id,
    difficulty, movement_pattern, force_type, mechanic, category, tags, short_description,
    instructions, tips, common_mistakes, media_url, thumbnail_url, is_published
)
VALUES
    -- =========================================================================
    -- CARDIO (12)
    -- =========================================================================
    (
        'running',
        'Running',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'hamstrings', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'all_levels', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Steady-state or interval running for cardiovascular conditioning.',
        ARRAY[
            'Warm up with 5 minutes of easy walking or light jogging.',
            'Run at a conversational pace, landing softly under your hips.',
            'Cool down with a few minutes of walking.'
        ],
        ARRAY['Keep shoulders relaxed.', 'Breathe rhythmically.', 'Build duration gradually.'],
        ARRAY['Overstriding', 'Ramping up mileage too fast', 'Skipping the warm-up'],
        NULL, NULL, true
    ),
    (
        'cycling',
        'Cycling',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'glutes', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'stationary-bike' LIMIT 1),
        'all_levels', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Low-impact cardio on a stationary or road bike.',
        ARRAY[
            'Adjust seat height so your knee has a slight bend at full extension.',
            'Pedal at a steady cadence, keeping your core braced.',
            'Vary resistance/incline to change intensity.'
        ],
        ARRAY['Keep a light grip on the handlebars.', 'Maintain a consistent cadence.'],
        ARRAY['Seat set too low or too high', 'Bouncing in the saddle'],
        NULL, NULL, true
    ),
    (
        'rowing-machine',
        'Rowing Machine',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back', 'lats', 'quads')),
        (SELECT id FROM equipment WHERE slug = 'rowing-machine' LIMIT 1),
        'intermediate', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Full-body cardio machine combining legs, core, and back.',
        ARRAY[
            'Drive with your legs first, then lean back and pull the handle to your ribs.',
            'Reverse the sequence on the return: arms, then hips, then knees.',
            'Keep a steady, sustainable stroke rate.'
        ],
        ARRAY['Legs drive the power, not your arms.', 'Keep your back flat, not rounded.'],
        ARRAY['Pulling with arms first', 'Rounding the lower back'],
        NULL, NULL, true
    ),
    (
        'jump-rope',
        'Jump Rope',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('calves', 'core')),
        (SELECT id FROM equipment WHERE slug = 'jumprope' LIMIT 1),
        'intermediate', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance', 'hiit'],
        'High-intensity, low-equipment cardio for conditioning and coordination.',
        ARRAY[
            'Hold rope handles at hip height, wrists doing most of the turning.',
            'Jump just high enough to clear the rope, landing softly on the balls of your feet.',
            'Keep a steady rhythm; rest as needed between intervals.'
        ],
        ARRAY['Keep elbows close to your body.', 'Land softly, not flat-footed.'],
        ARRAY['Jumping too high', 'Turning the rope with the whole arm'],
        NULL, NULL, true
    ),
    (
        'elliptical',
        'Elliptical',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'glutes')),
        (SELECT id FROM equipment WHERE slug = 'elliptical' LIMIT 1),
        'beginner', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Low-impact machine cardio for joints-friendly conditioning.',
        ARRAY[
            'Stand tall and hold the moving or stationary handles.',
            'Drive through your legs in a smooth, continuous motion.',
            'Adjust resistance and incline to change intensity.'
        ],
        ARRAY['Avoid leaning heavily on the handles.', 'Keep strides smooth and controlled.'],
        ARRAY['Slouching over the console', 'Using handles to do the work of your legs'],
        NULL, NULL, true
    ),
    (
        'stair-climber',
        'Stair Climber',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'glutes', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'stair-climber' LIMIT 1),
        'intermediate', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Sustained stepping cardio that emphasizes the lower body.',
        ARRAY[
            'Stand upright, avoid leaning on the rails.',
            'Take full steps and drive through your heels.',
            'Keep a steady pace you can sustain for the full interval.'
        ],
        ARRAY['Keep your posture tall.', 'Use the rails for balance only, not support.'],
        ARRAY['Leaning on the handrails', 'Taking short, shallow steps'],
        NULL, NULL, true
    ),
    (
        'swimming',
        'Swimming',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats', 'shoulders', 'core')),
        (SELECT id FROM equipment WHERE slug = 'pool' LIMIT 1),
        'intermediate', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Full-body, low-impact cardio in the pool.',
        ARRAY[
            'Warm up with a few easy, relaxed laps.',
            'Swim continuous laps or intervals at a sustainable pace.',
            'Focus on a steady breathing rhythm.'
        ],
        ARRAY['Keep your body streamlined in the water.', 'Exhale steadily underwater.'],
        ARRAY['Holding your breath', 'Lifting your head too high to breathe'],
        NULL, NULL, true
    ),
    (
        'walking',
        'Walking',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'beginner', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance', 'recovery'],
        'Low-intensity cardio suitable for warm-ups, recovery days, or building a base.',
        ARRAY[
            'Walk at a brisk, comfortable pace with an upright posture.',
            'Swing your arms naturally and breathe steadily.',
            'Increase pace or incline for more intensity.'
        ],
        ARRAY['Keep your stride natural, don''t overstride.', 'Engage your core lightly.'],
        ARRAY['Slouching', 'Looking down at a phone while walking'],
        NULL, NULL, true
    ),
    (
        'hiit-intervals',
        'HIIT Intervals',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'glutes', 'core')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'advanced', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'hiit', 'endurance'],
        'Alternating short bursts of maximal effort with brief recovery periods.',
        ARRAY[
            'Choose a movement (sprints, burpees, bike, etc.) and warm up thoroughly.',
            'Go all-out for 20-40 seconds, then rest or move easily for 20-60 seconds.',
            'Repeat for the target number of rounds, cooling down after.'
        ],
        ARRAY['Match effort to the interval, don''t pace like a steady run.', 'Prioritize full recovery between rounds.'],
        ARRAY['Skipping the warm-up', 'Not resting enough between rounds to sustain quality'],
        NULL, NULL, true
    ),
    (
        'stationary-bike-sprints',
        'Stationary Bike Sprints',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads', 'glutes')),
        (SELECT id FROM equipment WHERE slug = 'stationary-bike' LIMIT 1),
        'advanced', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'hiit', 'endurance'],
        'High-intensity bike intervals for conditioning and power.',
        ARRAY[
            'Warm up with 5 minutes of easy pedaling.',
            'Sprint at max effort for 15-30 seconds, then pedal easily to recover.',
            'Repeat for the target number of rounds.'
        ],
        ARRAY['Increase resistance for sprints rather than just cadence.', 'Keep your upper body stable.'],
        ARRAY['Sprinting with too little resistance (all cadence, no power)', 'Insufficient recovery between sprints'],
        NULL, NULL, true
    ),
    (
        'incline-treadmill-walk',
        'Incline Treadmill Walk',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'treadmill' LIMIT 1),
        'beginner', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Walking at an incline for low-impact cardio with extra lower-body emphasis.',
        ARRAY[
            'Set the treadmill to a moderate incline (start around 5-10%).',
            'Walk at a pace you can sustain without holding the rails.',
            'Increase incline or duration over time for progression.'
        ],
        ARRAY['Avoid gripping the handrails.', 'Keep your torso upright, don''t lean forward excessively.'],
        ARRAY['Holding the handrails for support', 'Setting incline too high too soon'],
        NULL, NULL, true
    ),
    (
        'shadow-boxing',
        'Shadow Boxing',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders', 'core')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'intermediate', NULL, NULL, 'other', 'cardio', ARRAY['cardio', 'endurance'],
        'Bodyweight boxing-style cardio combining footwork and punches.',
        ARRAY[
            'Stand in a boxing stance, hands guarding your face.',
            'Throw combinations of punches while moving your feet continuously.',
            'Keep your core engaged and breathe with each strike.'
        ],
        ARRAY['Stay light on your feet.', 'Rotate your hips into punches for power.'],
        ARRAY['Standing flat-footed', 'Dropping hands from guard position'],
        NULL, NULL, true
    ),
    -- =========================================================================
    -- STRETCH / YOGA (12)
    -- =========================================================================
    (
        'downward-dog',
        'Downward Dog',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('hamstrings', 'shoulders', 'calves')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Classic yoga pose stretching the hamstrings, calves, and shoulders.',
        ARRAY[
            'Start on hands and knees, hands slightly ahead of shoulders.',
            'Lift hips up and back, straightening legs into an inverted V.',
            'Press chest toward thighs and heels toward the floor. Hold and breathe.'
        ],
        ARRAY['Bend knees slightly if hamstrings are tight.', 'Spread fingers wide for stability.'],
        ARRAY['Rounding the upper back', 'Forcing heels flat at the expense of a flat back'],
        NULL, NULL, true
    ),
    (
        'childs-pose',
        'Child''s Pose',
        (SELECT id FROM muscle_groups WHERE slug = 'full-body' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats', 'glutes')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga', 'recovery'],
        'Resting yoga pose that gently stretches the back, hips, and shoulders.',
        ARRAY[
            'Kneel with big toes touching and knees wide.',
            'Sit hips back toward heels and extend arms forward on the mat.',
            'Relax your forehead down and breathe deeply. Hold.'
        ],
        ARRAY['Widen your knees for more room if needed.', 'Let your breath deepen the stretch.'],
        ARRAY['Holding tension in the shoulders', 'Rushing out of the pose'],
        NULL, NULL, true
    ),
    (
        'pigeon-pose',
        'Pigeon Pose',
        (SELECT id FROM muscle_groups WHERE slug = 'glutes' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('quads')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Deep hip-opening stretch targeting the glutes and hip rotators.',
        ARRAY[
            'From a tabletop position, bring one knee forward behind the wrist, shin angled across the mat.',
            'Extend the opposite leg straight back, hips squared toward the front.',
            'Fold forward over the front leg for a deeper stretch. Hold, then switch sides.'
        ],
        ARRAY['Use a cushion under the hip if it doesn''t reach the floor.', 'Keep hips square, not rotated.'],
        ARRAY['Letting the back knee splay into pain', 'Forcing the fold too soon'],
        NULL, NULL, true
    ),
    (
        'cat-cow',
        'Cat-Cow',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Gentle flowing stretch that mobilizes the spine.',
        ARRAY[
            'Start on hands and knees in tabletop position.',
            'Inhale, drop belly and lift chest and tailbone (cow).',
            'Exhale, round the spine and tuck chin and tailbone (cat). Repeat, flowing with breath.'
        ],
        ARRAY['Move slowly and match the movement to your breath.', 'Keep wrists stacked under shoulders.'],
        ARRAY['Moving too fast to feel the stretch', 'Collapsing into the wrists'],
        NULL, NULL, true
    ),
    (
        'hamstring-stretch',
        'Hamstring Stretch',
        (SELECT id FROM muscle_groups WHERE slug = 'hamstrings' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('calves')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility'],
        'Standing or seated stretch targeting the back of the thigh.',
        ARRAY[
            'Sit or stand with one leg extended, foot flexed.',
            'Hinge forward from the hips, reaching toward your toes.',
            'Keep your back long rather than rounding. Hold, then switch sides.'
        ],
        ARRAY['Hinge from the hips, not the lower back.', 'Bend the knee slightly if needed.'],
        ARRAY['Rounding the lower back to reach farther', 'Bouncing into the stretch'],
        NULL, NULL, true
    ),
    (
        'hip-flexor-stretch',
        'Hip Flexor Stretch',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility'],
        'Kneeling lunge stretch for the front of the hip.',
        ARRAY[
            'Kneel on one knee with the other foot planted in front, both knees at ~90°.',
            'Tuck your pelvis slightly and shift your hips forward.',
            'Keep your torso upright. Hold, then switch sides.'
        ],
        ARRAY['Squeeze the glute on the kneeling side to deepen the stretch.', 'Keep the front knee over the ankle.'],
        ARRAY['Letting the front knee drift past the toes', 'Arching the lower back instead of tucking the pelvis'],
        NULL, NULL, true
    ),
    (
        'shoulder-stretch',
        'Shoulder Stretch',
        (SELECT id FROM muscle_groups WHERE slug = 'shoulders' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('upper-back')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility'],
        'Cross-body stretch for the rear and outer shoulder.',
        ARRAY[
            'Bring one arm across your chest at shoulder height.',
            'Use the opposite hand or forearm to gently pull it closer.',
            'Keep the shoulder down, away from the ear. Hold, then switch sides.'
        ],
        ARRAY['Keep shoulders relaxed, not shrugged.', 'Ease in gradually, don''t yank the arm.'],
        ARRAY['Shrugging the shoulder up', 'Pulling too hard, too fast'],
        NULL, NULL, true
    ),
    (
        'warrior-pose',
        'Warrior Pose',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes', 'shoulders')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Standing yoga pose building leg strength and hip mobility.',
        ARRAY[
            'Step one foot back into a wide lunge stance, back foot angled out.',
            'Bend the front knee to about 90°, squaring hips toward the front.',
            'Raise arms overhead or out to the sides. Hold, then switch sides.'
        ],
        ARRAY['Keep the front knee tracking over the ankle.', 'Root down through the outer edge of the back foot.'],
        ARRAY['Letting the front knee cave inward', 'Leaning the torso too far forward'],
        NULL, NULL, true
    ),
    (
        'seated-forward-fold',
        'Seated Forward Fold',
        (SELECT id FROM muscle_groups WHERE slug = 'hamstrings' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('lats')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Seated yoga fold stretching the hamstrings and low back.',
        ARRAY[
            'Sit with both legs extended straight in front of you.',
            'Hinge forward from the hips, reaching toward your feet.',
            'Let your head and neck relax. Hold and breathe.'
        ],
        ARRAY['Bend knees slightly if hamstrings are very tight.', 'Lead with your chest, not your head.'],
        ARRAY['Rounding aggressively from the low back', 'Forcing the reach instead of easing in'],
        NULL, NULL, true
    ),
    (
        'quad-stretch',
        'Quad Stretch',
        (SELECT id FROM muscle_groups WHERE slug = 'quads' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility'],
        'Standing stretch for the front of the thigh.',
        ARRAY[
            'Stand tall, holding a wall or chair for balance if needed.',
            'Bend one knee, bringing your heel toward your glutes and grasping your ankle.',
            'Keep knees close together and hips level. Hold, then switch sides.'
        ],
        ARRAY['Keep your standing knee soft, not locked.', 'Tuck your pelvis slightly to deepen the stretch.'],
        ARRAY['Letting the bent knee drift out to the side', 'Arching the lower back'],
        NULL, NULL, true
    ),
    (
        'chest-doorway-stretch',
        'Chest Doorway Stretch',
        (SELECT id FROM muscle_groups WHERE slug = 'chest' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('shoulders')),
        (SELECT id FROM equipment WHERE slug = 'bodyweight' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility'],
        'Doorway stretch opening the chest and front shoulders.',
        ARRAY[
            'Stand in a doorway with forearms braced on the frame, elbows at shoulder height.',
            'Step one foot forward and lean your body weight gently through the doorway.',
            'Feel the stretch across your chest. Hold and breathe.'
        ],
        ARRAY['Keep your core braced so you don''t arch the lower back.', 'Adjust arm height to shift the stretch.'],
        ARRAY['Overextending the lower back', 'Leaning too aggressively at first'],
        NULL, NULL, true
    ),
    (
        'spinal-twist',
        'Spinal Twist',
        (SELECT id FROM muscle_groups WHERE slug = 'core' LIMIT 1),
        ARRAY(SELECT id FROM muscle_groups WHERE slug IN ('glutes')),
        (SELECT id FROM equipment WHERE slug = 'yoga-mat' LIMIT 1),
        'all_levels', NULL, 'static', 'other', 'stretch', ARRAY['stretching', 'mobility', 'yoga'],
        'Seated or supine twist releasing the spine, obliques, and glutes.',
        ARRAY[
            'Sit or lie on your back, then cross one leg over the other.',
            'Rotate your torso toward the bent knee, using your opposite arm as leverage.',
            'Keep both shoulders grounded (if supine) or your spine tall (if seated). Hold, then switch sides.'
        ],
        ARRAY['Lengthen the spine before twisting.', 'Turn from the ribcage, not just the neck.'],
        ARRAY['Forcing the twist with the neck', 'Letting shoulders lift off the floor'],
        NULL, NULL, true
    )
ON CONFLICT (slug) DO NOTHING;
