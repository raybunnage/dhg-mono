-- Rename media tables to follow the new naming convention
-- This migration renames media-related tables to use the 'learn_' prefix

-- 1. Rename media_sessions to learn_media_sessions
ALTER TABLE media_sessions RENAME TO learn_media_sessions;

-- 2. Rename media_playback_events to learn_media_playback_events
ALTER TABLE media_playback_events RENAME TO learn_media_playback_events;

-- 3. Rename media_topic_segments to learn_media_topic_segments
ALTER TABLE media_topic_segments RENAME TO learn_media_topic_segments;

-- 4. Rename media_bookmarks to learn_media_bookmarks
ALTER TABLE media_bookmarks RENAME TO learn_media_bookmarks;

-- Create compatibility views for backward compatibility (optional)
-- These views allow existing code to continue working during the transition

CREATE OR REPLACE VIEW media_sessions AS SELECT * FROM learn_media_sessions;
CREATE OR REPLACE VIEW media_playback_events AS SELECT * FROM learn_media_playback_events;
CREATE OR REPLACE VIEW media_topic_segments AS SELECT * FROM learn_media_topic_segments;
CREATE OR REPLACE VIEW media_bookmarks AS SELECT * FROM learn_media_bookmarks;

-- Insert migration records into sys_table_migrations
INSERT INTO sys_table_migrations (old_name, new_name, migration_type, status, created_at, updated_at)
VALUES 
  ('media_sessions', 'learn_media_sessions', 'rename', 'active', NOW(), NOW()),
  ('media_playback_events', 'learn_media_playback_events', 'rename', 'active', NOW(), NOW()),
  ('media_topic_segments', 'learn_media_topic_segments', 'rename', 'active', NOW(), NOW()),
  ('media_bookmarks', 'learn_media_bookmarks', 'rename', 'active', NOW(), NOW());

-- Update any foreign key constraints if they exist
-- Note: You may need to adjust these based on your actual foreign key relationships

-- For media_playback_events referencing media_sessions
ALTER TABLE learn_media_playback_events 
  DROP CONSTRAINT IF EXISTS media_playback_events_session_id_fkey,
  ADD CONSTRAINT learn_media_playback_events_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES learn_media_sessions(id);

-- For media_topic_segments if it references other tables
-- Add similar constraint updates as needed

-- For media_bookmarks if it references media content
-- Add similar constraint updates as needed

-- Update RLS policies if they exist
-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own media sessions" ON learn_media_sessions;
DROP POLICY IF EXISTS "Users can create their own media sessions" ON learn_media_sessions;
DROP POLICY IF EXISTS "Users can update their own media sessions" ON learn_media_sessions;
DROP POLICY IF EXISTS "Users can delete their own media sessions" ON learn_media_sessions;

DROP POLICY IF EXISTS "Users can view their own playback events" ON learn_media_playback_events;
DROP POLICY IF EXISTS "Users can create their own playback events" ON learn_media_playback_events;

DROP POLICY IF EXISTS "Users can view their own bookmarks" ON learn_media_bookmarks;
DROP POLICY IF EXISTS "Users can create their own bookmarks" ON learn_media_bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON learn_media_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON learn_media_bookmarks;

-- Create new policies with updated names
CREATE POLICY "Users can view their own media sessions" ON learn_media_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own media sessions" ON learn_media_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media sessions" ON learn_media_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media sessions" ON learn_media_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own playback events" ON learn_media_playback_events
  FOR SELECT USING (session_id IN (SELECT id FROM learn_media_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own playback events" ON learn_media_playback_events
  FOR INSERT WITH CHECK (session_id IN (SELECT id FROM learn_media_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own bookmarks" ON learn_media_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks" ON learn_media_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks" ON learn_media_bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON learn_media_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions on the views for backward compatibility
GRANT SELECT, INSERT, UPDATE, DELETE ON media_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_playback_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_topic_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_bookmarks TO authenticated;

-- Add comments to document the rename
COMMENT ON TABLE learn_media_sessions IS 'Renamed from media_sessions - tracks user media viewing/listening sessions';
COMMENT ON TABLE learn_media_playback_events IS 'Renamed from media_playback_events - tracks playback events within sessions';
COMMENT ON TABLE learn_media_topic_segments IS 'Renamed from media_topic_segments - defines topic segments within media content';
COMMENT ON TABLE learn_media_bookmarks IS 'Renamed from media_bookmarks - stores user bookmarks for media content';