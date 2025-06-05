-- Media Tracking Tables RLS Policies
-- Created: May 20, 2025
-- These policies provide permissive CRUD operations for all media tracking tables
-- Note: In production, you'll likely want to restrict these policies further

-- Enable RLS on all media tracking tables
ALTER TABLE media_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_playback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_topic_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_preferences ENABLE ROW LEVEL SECURITY;

-- media_sessions policies
-- Allow full read access to all authenticated users
CREATE POLICY "Allow read access for all authenticated users"
  ON media_sessions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only allow users to insert/update/delete their own data
-- Note: This assumes you'll add a user_id column to the tables when implementing auth
-- For now, this policy allows any authenticated user to perform these operations
CREATE POLICY "Allow insert for authenticated users"
  ON media_sessions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON media_sessions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users"
  ON media_sessions
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- media_playback_events policies
CREATE POLICY "Allow read access for all authenticated users"
  ON media_playback_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users"
  ON media_playback_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON media_playback_events
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users"
  ON media_playback_events
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- media_bookmarks policies
CREATE POLICY "Allow read access for all authenticated users"
  ON media_bookmarks
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users"
  ON media_bookmarks
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON media_bookmarks
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users"
  ON media_bookmarks
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- learn_topics policies
-- For learning topics, we allow read access to all authenticated users
-- But restrict write operations to service_role (admin)
CREATE POLICY "Allow read access for all authenticated users"
  ON learn_topics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for service role"
  ON learn_topics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow update for service role"
  ON learn_topics
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow delete for service role"
  ON learn_topics
  FOR DELETE
  USING (auth.role() = 'service_role');

-- media_topic_segments policies
CREATE POLICY "Allow read access for all authenticated users"
  ON media_topic_segments
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for service role"
  ON media_topic_segments
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow update for service role"
  ON media_topic_segments
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow delete for service role"
  ON media_topic_segments
  FOR DELETE
  USING (auth.role() = 'service_role');

-- learn_user_interests policies
CREATE POLICY "Allow read access for all authenticated users"
  ON learn_user_interests
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users"
  ON learn_user_interests
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON learn_user_interests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users"
  ON learn_user_interests
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- expert_preferences policies
CREATE POLICY "Allow read access for all authenticated users"
  ON expert_preferences
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users"
  ON expert_preferences
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users"
  ON expert_preferences
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users"
  ON expert_preferences
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- IMPORTANT NOTE: 
-- These are permissive policies for development. In production, you should:
-- 1. Add user_id column to each table that needs user-specific data
-- 2. Update policies to check auth.uid() = user_id for user-specific operations
-- 3. Consider additional security constraints based on your application needs