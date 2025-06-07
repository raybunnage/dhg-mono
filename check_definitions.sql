SELECT table_name FROM sys_table_definitions WHERE table_name LIKE 'worktree_%' OR table_name LIKE 'import_%' OR table_name LIKE 'registry_%' OR table_name LIKE 'service_%' ORDER BY table_name;
