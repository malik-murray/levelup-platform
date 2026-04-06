-- Long default name overflowed mobile habit UI; keep meaning, shorten label.
UPDATE habit_templates
SET name = 'Study / learn'
WHERE name = 'Study/Learn (business, AI, dev, marketing)';
