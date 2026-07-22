-- Normalize empty strings and invalid values to NULL
UPDATE curricula SET grade_level = NULL WHERE grade_level = '';
UPDATE curricula SET grade_level = NULL
WHERE grade_level IS NOT NULL
  AND grade_level NOT IN (
    'Any','Pre-K','Kindergarten',
    '1st Grade','2nd Grade','3rd Grade','4th Grade','5th Grade','6th Grade',
    '7th Grade','8th Grade','9th Grade','10th Grade','11th Grade','12th Grade',
    'Elementary','Middle School','High School','College','Adult'
  );

-- Add constraint
ALTER TABLE curricula
  ADD CONSTRAINT curricula_grade_level_check
  CHECK (grade_level IN (
    'Any','Pre-K','Kindergarten',
    '1st Grade','2nd Grade','3rd Grade','4th Grade','5th Grade','6th Grade',
    '7th Grade','8th Grade','9th Grade','10th Grade','11th Grade','12th Grade',
    'Elementary','Middle School','High School','College','Adult'
  ));
