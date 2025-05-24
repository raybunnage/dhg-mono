-- Migration: Unified Learning Platform Architecture (Fixed)
-- Description: Implements core tables for learning platform with allowed_emails.id as universal user ID

-- 1. Drop access_requests table as specified
DROP TABLE IF EXISTS access_requests CASCADE;

-- 2. Update allowed_emails table with auth tracking fields
ALTER TABLE allowed_emails 
ADD COLUMN IF NOT EXISTS auth_user_id UUID,
ADD COLUMN IF NOT EXISTS auth_status TEXT DEFAULT 'none' 
  CHECK (auth_status IN ('none', 'invited', 'active')),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for auth_user_id lookups
CREATE INDEX IF NOT EXISTS idx_allowed_emails_auth_user_id ON allowed_emails(auth_user_id);

-- 3. Drop existing user_profiles_v2 if exists to recreate with new structure
DROP TABLE IF EXISTS user_profiles_v2 CASCADE;

-- Create user_profiles_v2 table
CREATE TABLE user_profiles_v2 (
  -- Identity
  id UUID PRIMARY KEY REFERENCES allowed_emails(id) ON DELETE CASCADE,
  
  -- Professional Background
  profession TEXT,
  professional_title TEXT,
  years_experience INTEGER,
  industry_sectors TEXT[],
  specialty_areas TEXT[],
  credentials TEXT[],
  
  -- Learning Preferences
  learning_goals TEXT[],
  reason_for_learning TEXT,
  preferred_formats TEXT[] DEFAULT ARRAY['video', 'audio']::TEXT[],
  learning_pace TEXT CHECK (learning_pace IN ('self-paced', 'structured', 'intensive')),
  time_commitment TEXT,
  preferred_depth TEXT CHECK (preferred_depth IN ('beginner', 'intermediate', 'advanced')),
  preferred_session_length INTEGER, -- minutes
  
  -- Content Interests
  interested_topics TEXT[],
  interested_experts UUID[], -- References experts.id
  avoided_topics TEXT[],
  priority_subjects TEXT[],
  content_tags_following TEXT[],
  
  -- Bio & Context
  bio_summary TEXT,
  learning_background TEXT,
  current_challenges TEXT,
  intended_application TEXT,
  referral_source TEXT,
  
  -- System Fields
  onboarding_completed BOOLEAN DEFAULT false,
  profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_profiles_v2
CREATE INDEX idx_user_profiles_interested_topics ON user_profiles_v2 USING GIN(interested_topics);
CREATE INDEX idx_user_profiles_interested_experts ON user_profiles_v2 USING GIN(interested_experts);

-- 4. Create media_sessions table
DROP TABLE IF EXISTS media_sessions CASCADE;
CREATE TABLE media_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES allowed_emails(id) ON DELETE CASCADE,
  media_id UUID, -- Will reference presentations/media table
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  completion_percentage FLOAT CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  device_type TEXT,
  session_type TEXT CHECK (session_type IN ('learning', 'review', 'reference')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for media_sessions
CREATE INDEX idx_media_sessions_user_id ON media_sessions(user_id);
CREATE INDEX idx_media_sessions_media_id ON media_sessions(media_id);
CREATE INDEX idx_media_sessions_session_start ON media_sessions(session_start);

-- 5. Create media_playback_events table
DROP TABLE IF EXISTS media_playback_events CASCADE;
CREATE TABLE media_playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES media_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES allowed_emails(id) ON DELETE CASCADE, -- For quick queries
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'speed_change', 'complete')),
  timestamp_seconds FLOAT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for media_playback_events
CREATE INDEX idx_media_playback_events_session_id ON media_playback_events(session_id);
CREATE INDEX idx_media_playback_events_user_id ON media_playback_events(user_id);
CREATE INDEX idx_media_playback_events_created_at ON media_playback_events(created_at);

-- 6. Create media_topic_segments table
DROP TABLE IF EXISTS media_topic_segments CASCADE;
CREATE TABLE media_topic_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL, -- References presentations/media
  topic_id UUID, -- References topics/taxonomy
  segment_title TEXT,
  start_time_seconds FLOAT NOT NULL,
  end_time_seconds FLOAT NOT NULL,
  ai_summary TEXT,
  key_concepts TEXT[],
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_time_range CHECK (end_time_seconds > start_time_seconds)
);

-- Indexes for media_topic_segments
CREATE INDEX idx_media_topic_segments_media_id ON media_topic_segments(media_id);
CREATE INDEX idx_media_topic_segments_topic_id ON media_topic_segments(topic_id);

-- 7. Create media_bookmarks table
DROP TABLE IF EXISTS media_bookmarks CASCADE;
CREATE TABLE media_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES allowed_emails(id) ON DELETE CASCADE,
  media_id UUID NOT NULL,
  timestamp_seconds FLOAT NOT NULL,
  note TEXT,
  bookmark_type TEXT CHECK (bookmark_type IN ('important', 'question', 'review', 'reference')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for media_bookmarks
CREATE INDEX idx_media_bookmarks_user_id ON media_bookmarks(user_id);
CREATE INDEX idx_media_bookmarks_media_id ON media_bookmarks(media_id);
CREATE INDEX idx_media_bookmarks_tags ON media_bookmarks USING GIN(tags);

-- 8. Create user_content_scores for personalization
DROP TABLE IF EXISTS user_content_scores CASCADE;
CREATE TABLE user_content_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES allowed_emails(id) ON DELETE CASCADE,
  media_id UUID NOT NULL,
  relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 1),
  difficulty_match FLOAT CHECK (difficulty_match >= 0 AND difficulty_match <= 1),
  engagement_score FLOAT CHECK (engagement_score >= 0 AND engagement_score <= 1),
  reason TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  shown_to_user BOOLEAN DEFAULT false,
  
  UNIQUE(user_id, media_id)
);

-- Indexes for user_content_scores
CREATE INDEX idx_user_content_scores_user_id ON user_content_scores(user_id);
CREATE INDEX idx_user_content_scores_relevance ON user_content_scores(relevance_score DESC);

-- 9. Create user_learning_analytics for aggregated data
DROP TABLE IF EXISTS user_learning_analytics CASCADE;
CREATE TABLE user_learning_analytics (
  user_id UUID PRIMARY KEY REFERENCES allowed_emails(id) ON DELETE CASCADE,
  total_minutes_watched INTEGER DEFAULT 0,
  average_session_length INTEGER DEFAULT 0,
  topics_explored TEXT[] DEFAULT '{}',
  experts_followed TEXT[] DEFAULT '{}',
  preferred_time_of_day TEXT,
  completion_rate FLOAT DEFAULT 0,
  quiz_average_score FLOAT,
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  insights JSONB DEFAULT '{}'::JSONB
);

-- 10. Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
DO $$
BEGIN
    -- Only create trigger if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_allowed_emails_updated_at') THEN
        CREATE TRIGGER update_allowed_emails_updated_at BEFORE UPDATE ON allowed_emails
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Create trigger for user_profiles_v2
    CREATE TRIGGER update_user_profiles_v2_updated_at BEFORE UPDATE ON user_profiles_v2
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END;
$$;

-- 11. Create function to sync auth user creation
CREATE OR REPLACE FUNCTION sync_auth_user_to_allowed_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new auth.user is created, update allowed_emails
  UPDATE allowed_emails 
  SET 
    auth_user_id = NEW.id,
    auth_status = 'active',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'auth_created_at', NEW.created_at,
      'auth_provider', COALESCE(NEW.app_metadata->>'provider', 'email')
    ),
    updated_at = NOW()
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth user sync (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION sync_auth_user_to_allowed_emails();
  END IF;
END;
$$;

-- 12. Create useful views
DROP VIEW IF EXISTS user_learning_progress;
CREATE VIEW user_learning_progress AS
SELECT 
    up.id as user_id,
    ae.name,
    ae.email,
    up.learning_goals,
    COUNT(DISTINCT ms.media_id) as videos_watched,
    COALESCE(SUM(ms.total_duration_seconds) / 60, 0) as total_minutes,
    COALESCE(AVG(ms.completion_percentage), 0) as avg_completion,
    COUNT(DISTINCT mb.id) as bookmarks_created,
    up.interested_topics,
    up.profile_completeness,
    up.onboarding_completed
FROM allowed_emails ae
JOIN user_profiles_v2 up ON ae.id = up.id
LEFT JOIN media_sessions ms ON up.id = ms.user_id
LEFT JOIN media_bookmarks mb ON up.id = mb.user_id
GROUP BY up.id, ae.name, ae.email, up.learning_goals, up.interested_topics, 
         up.profile_completeness, up.onboarding_completed;

-- 13. Add RLS policies for security
ALTER TABLE user_profiles_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_playback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
    -- user_profiles_v2 policies
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles_v2;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles_v2;
    
    -- media_sessions policies
    DROP POLICY IF EXISTS "Users can view own sessions" ON media_sessions;
    DROP POLICY IF EXISTS "Users can create own sessions" ON media_sessions;
    
    -- media_playback_events policies
    DROP POLICY IF EXISTS "Users can view own playback events" ON media_playback_events;
    DROP POLICY IF EXISTS "Users can create own playback events" ON media_playback_events;
    
    -- media_bookmarks policies
    DROP POLICY IF EXISTS "Users can view own bookmarks" ON media_bookmarks;
    DROP POLICY IF EXISTS "Users can manage own bookmarks" ON media_bookmarks;
    
    -- user_content_scores policies
    DROP POLICY IF EXISTS "Users can view own scores" ON user_content_scores;
    
    -- user_learning_analytics policies
    DROP POLICY IF EXISTS "Users can view own analytics" ON user_learning_analytics;
END;
$$;

-- Create new RLS policies

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles_v2
  FOR SELECT USING (
    id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = user_profiles_v2.id
    )
  );

CREATE POLICY "Users can update own profile" ON user_profiles_v2
  FOR UPDATE USING (
    id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid()
    )
  );

-- Users can view and create their own sessions
CREATE POLICY "Users can view own sessions" ON media_sessions
  FOR SELECT USING (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = media_sessions.user_id
    )
  );

CREATE POLICY "Users can create own sessions" ON media_sessions
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid()
    )
  );

-- Users can view and create their own playback events
CREATE POLICY "Users can view own playback events" ON media_playback_events
  FOR SELECT USING (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = media_playback_events.user_id
    )
  );

CREATE POLICY "Users can create own playback events" ON media_playback_events
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid()
    )
  );

-- Users can manage their own bookmarks
CREATE POLICY "Users can manage own bookmarks" ON media_bookmarks
  FOR ALL USING (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = media_bookmarks.user_id
    )
  );

-- Users can view their own content scores
CREATE POLICY "Users can view own scores" ON user_content_scores
  FOR SELECT USING (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = user_content_scores.user_id
    )
  );

-- Users can view their own analytics
CREATE POLICY "Users can view own analytics" ON user_learning_analytics
  FOR SELECT USING (
    user_id IN (
      SELECT ae.id FROM allowed_emails ae 
      WHERE ae.auth_user_id = auth.uid() OR ae.id = user_learning_analytics.user_id
    )
  );

-- 14. Add comments for documentation
COMMENT ON TABLE user_profiles_v2 IS 'Comprehensive user profiles linked to allowed_emails for learning preferences and personalization';
COMMENT ON TABLE media_sessions IS 'Tracks user viewing sessions for presentations/media';
COMMENT ON TABLE media_playback_events IS 'Detailed playback events within media sessions';
COMMENT ON TABLE media_topic_segments IS 'AI-identified topic segments within media for content matching';
COMMENT ON TABLE media_bookmarks IS 'User-created bookmarks and notes on media content';
COMMENT ON TABLE user_content_scores IS 'Personalized content relevance scores for recommendations';
COMMENT ON TABLE user_learning_analytics IS 'Aggregated learning analytics per user';

-- Migration complete message
DO $$
BEGIN
  RAISE NOTICE 'Unified Learning Platform migration completed successfully';
  RAISE NOTICE 'Tables created/updated: allowed_emails, user_profiles_v2, media_sessions, media_playback_events, media_topic_segments, media_bookmarks, user_content_scores, user_learning_analytics';
  RAISE NOTICE 'access_requests table has been dropped as requested';
END;
$$;