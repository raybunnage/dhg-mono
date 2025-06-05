-- Register git_workflow pipeline and commands
INSERT INTO command_pipelines (name, display_name, description, script_path, status)
VALUES (
    'git_workflow',
    'Git Workflow',
    'Git workflow management, testing, and branch promotion',
    'scripts/cli-pipeline/git_workflow/git-workflow-cli.sh',
    'active'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

-- Get pipeline ID
WITH pipeline AS (
    SELECT id FROM command_pipelines WHERE name = 'git_workflow'
)
-- Insert commands
INSERT INTO command_definitions (pipeline_id, command_name, description, category, status)
SELECT 
    p.id,
    cmd.command_name,
    cmd.description,
    cmd.category,
    'active'
FROM pipeline p, (VALUES
    -- Git Information
    ('git-info', 'Show comprehensive git information', 'info'),
    ('git-status', 'Show git status', 'info'),
    ('worktree-list', 'List all git worktrees', 'info'),
    
    -- Branch Management
    ('current-branch', 'Show current branch', 'branch'),
    ('list-branches', 'List all branches (local and remote)', 'branch'),
    ('create-branch', 'Create and checkout new branch', 'branch'),
    
    -- Testing & Validation
    ('run-tests', 'Run test suite', 'test'),
    ('check-types', 'Check TypeScript types', 'test'),
    ('run-lint', 'Run linter', 'test'),
    ('pre-commit', 'Run all pre-commit checks', 'test'),
    
    -- Promotion Workflow
    ('promote-to-dev', 'Merge current branch to development', 'promotion'),
    ('promote-to-main', 'Merge development to main', 'promotion'),
    
    -- Environment Management
    ('copy-env', 'Copy .env.development from another worktree', 'env'),
    
    -- Utility Commands
    ('prune-branches', 'Remove merged branches', 'utility')
) AS cmd(command_name, description, category)
ON CONFLICT (pipeline_id, command_name) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    status = EXCLUDED.status;