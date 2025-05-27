-- Create table migration tracking system
-- This table tracks all table renames to enable safe migrations and rollbacks

CREATE TABLE IF NOT EXISTS sys_table_migrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW(),
  migrated_by TEXT DEFAULT current_user,
  rollback_at TIMESTAMP,
  rollback_by TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rolled_back', 'pending')),
  compatibility_view_created BOOLEAN DEFAULT true,
  dependencies JSONB, -- Store info about FKs, indexes, etc.
  notes TEXT,
  UNIQUE(old_name, status) -- Prevent duplicate active migrations
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sys_table_migrations_status ON sys_table_migrations(status);
CREATE INDEX IF NOT EXISTS idx_sys_table_migrations_new_name ON sys_table_migrations(new_name);

-- Grant appropriate permissions
GRANT SELECT ON sys_table_migrations TO authenticated;
GRANT ALL ON sys_table_migrations TO service_role;

-- Add RLS policy
ALTER TABLE sys_table_migrations ENABLE ROW LEVEL SECURITY;

-- Only service role can modify migration tracking
CREATE POLICY "Service role full access" ON sys_table_migrations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Authenticated users can read migration status
CREATE POLICY "Authenticated read access" ON sys_table_migrations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Add helpful comment
COMMENT ON TABLE sys_table_migrations IS 'Tracks table renaming operations for safe migrations and rollbacks';
COMMENT ON COLUMN sys_table_migrations.dependencies IS 'JSON object containing foreign keys, indexes, triggers, and other dependent objects';