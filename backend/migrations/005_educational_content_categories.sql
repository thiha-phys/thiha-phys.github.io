-- Expand educational content categories to include the three-part objective quizzes.
ALTER TABLE educational_content DROP CONSTRAINT IF EXISTS educational_content_category_check;
ALTER TABLE educational_content ADD CONSTRAINT educational_content_category_check
  CHECK (category IN ('old_questions','one_mark','objectives','calculations','short_questions','definitions'));
