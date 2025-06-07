-- Populate worktree_definitions with default data
INSERT INTO worktree_definitions (path, alias, emoji, description, is_active, display_order)
VALUES 
  ('development', 'dev', '🚀', 'Main development branch', true, 1),
  ('feature/improve-prompt-service-add-page', 'prompt', '📝', 'Improve prompt service functionality', true, 2),
  ('feature/create-subject-list-page', 'subjects', '📚', 'Create subject list page', true, 3),
  ('feature/create-single-database-layout', 'db-layout', '🗄️', 'Single database layout feature', true, 4),
  ('feature/single-button', 'button', '🔘', 'Single button feature', true, 5),
  ('feature/git-worktree-tracker', 'git-tracker', '🌳', 'Git worktree tracking feature', true, 6),
  ('feature/continuous-monitor', 'monitor', '📊', 'Continuous monitoring feature', true, 7),
  ('feature/expert-profile-page', 'experts', '👥', 'Expert profile page feature', true, 8)
ON CONFLICT (path) DO UPDATE
SET 
  alias = EXCLUDED.alias,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;