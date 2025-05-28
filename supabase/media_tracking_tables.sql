-- Media Tracking Tables for Video and Audio Applications
-- Created: May 19, 2025

-------------------------------------------------------
-- CORE TRACKING TABLES - IMPLEMENTATION PRIORITY HIGH
-------------------------------------------------------

-- Media Sessions - Tracks overall engagement with media files
CREATE TABLE IF NOT EXISTS media_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  app_id TEXT NOT NULL, -- Identifier for the app (e.g., 'audio-app', 'video-app')
  source_id UUID REFERENCES google_sources(id), -- Link to the media file in google_sources
  presentation_id UUID REFERENCES presentations(id), -- Link to presentation if applicable
  expert_document_id UUID REFERENCES google_expert_documents(id), -- Link to transcript if applicable
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_play_duration REAL DEFAULT 0, -- Total seconds of actual playback
  completion_percentage REAL DEFAULT 0, -- 0-100% of media consumed
  play_count INTEGER DEFAULT 1, -- Number of times started playback
  last_position REAL DEFAULT 0, -- Last playback position in seconds
  playback_rate REAL DEFAULT 1.0, -- Playback speed multiplier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Media Playback Events - Detailed playback event logs
CREATE TABLE IF NOT EXISTS media_playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  session_id UUID REFERENCES media_sessions(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'stop', 'complete', 'rate-change')),
  position REAL NOT NULL, -- Position in seconds when event occurred
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  data JSONB -- Additional event-specific data (e.g., seek target, playback rate)
);

-- Media Bookmarks - Saved positions, highlights and key sections
CREATE TABLE IF NOT EXISTS media_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  session_id UUID REFERENCES media_sessions(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES google_sources(id), -- Direct link to the media source for cross-session bookmarks
  bookmark_type TEXT NOT NULL CHECK (bookmark_type IN ('favorite', 'highlight', 'resume', 'section', 'note')),
  title TEXT,
  description TEXT,
  start_position REAL NOT NULL, -- Start timestamp in seconds
  end_position REAL, -- End timestamp in seconds (for sections/highlights)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  metadata JSONB -- Additional bookmark data (tags, categories, etc.)
);

-------------------------------------------------------
-- LEARNING/TOPIC TRACKING - IMPLEMENTATION PRIORITY MEDIUM
-------------------------------------------------------

-- Learning Topics - Identified topics in media for focused learning
CREATE TABLE IF NOT EXISTS learn_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_topic_id UUID REFERENCES learn_topics(id), -- For hierarchical topics
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(name)
);

-- Media Topic Segments - Maps topics to specific parts of media
CREATE TABLE IF NOT EXISTS media_topic_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  source_id UUID REFERENCES google_sources(id) NOT NULL,
  topic_id UUID REFERENCES learn_topics(id) NOT NULL,
  expert_id UUID REFERENCES experts(id), -- Link to expert discussing topic (if applicable)
  start_position REAL NOT NULL, -- Start timestamp in seconds
  end_position REAL NOT NULL, -- End timestamp in seconds
  relevance_score REAL DEFAULT 1.0, -- AI-determined relevance (0.0-1.0)
  transcript_excerpt TEXT, -- Relevant transcript portion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-------------------------------------------------------
-- PERSONALIZATION - IMPLEMENTATION PRIORITY MEDIUM
-------------------------------------------------------

-- User Subject Interests - Tracks which subjects a user is interested in
CREATE TABLE IF NOT EXISTS learn_user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  subject_classification_id UUID REFERENCES learn_subject_classifications(id) NOT NULL,
  interest_level INTEGER CHECK (interest_level BETWEEN 1 AND 5), -- 1-5 rating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Expert Preferences - Tracks user preferences for specific experts
CREATE TABLE IF NOT EXISTS expert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  expert_id UUID REFERENCES experts(id) NOT NULL,
  preference_level INTEGER CHECK (preference_level BETWEEN 1 AND 5), -- 1-5 rating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-------------------------------------------------------
-- ADVANCED FEATURES - IMPLEMENTATION PRIORITY LOW
-------------------------------------------------------

-- Future implementation tables - commented out for now
/*
-- Media Recommendations - AI-generated media recommendations
CREATE TABLE IF NOT EXISTS media_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  source_id UUID REFERENCES google_sources(id) NOT NULL,
  recommendation_reason TEXT NOT NULL, -- Why this was recommended
  relevance_score REAL CHECK (relevance_score BETWEEN 0.0 AND 1.0),
  topics JSONB, -- Array of related topics
  experts JSONB, -- Array of featured experts
  was_consumed BOOLEAN DEFAULT false, -- Whether recommendation was followed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Learning Assessments - Track learning comprehension
CREATE TABLE IF NOT EXISTS learning_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  session_id UUID REFERENCES media_sessions(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES learn_topics(id),
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('quiz', 'reflection', 'summary', 'notes')),
  content TEXT NOT NULL, -- Question or prompt
  response TEXT, -- User's response
  score REAL, -- Score if applicable (0.0-1.0)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Learning Progress - Overall progress tracking across topics
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  topic_id UUID REFERENCES learn_topics(id) NOT NULL,
  proficiency_level TEXT CHECK (proficiency_level IN ('novice', 'beginner', 'intermediate', 'advanced', 'expert')),
  media_consumed JSONB, -- List of consumed media for this topic
  time_spent REAL DEFAULT 0, -- Total time spent on topic (seconds)
  assessments_completed INTEGER DEFAULT 0,
  assessment_average_score REAL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
*/

-------------------------------------------------------
-- INDEXES - CRITICAL FOR PERFORMANCE
-------------------------------------------------------

-- Core media session indexes
CREATE INDEX IF NOT EXISTS idx_media_sessions_source_id ON media_sessions(source_id);
CREATE INDEX IF NOT EXISTS idx_media_sessions_presentation_id ON media_sessions(presentation_id);
CREATE INDEX IF NOT EXISTS idx_media_sessions_expert_document_id ON media_sessions(expert_document_id);
CREATE INDEX IF NOT EXISTS idx_media_sessions_app_id ON media_sessions(app_id);
CREATE INDEX IF NOT EXISTS idx_media_sessions_media_type ON media_sessions(media_type);

-- Event and bookmark indexes
CREATE INDEX IF NOT EXISTS idx_media_playback_events_session_id ON media_playback_events(session_id);
CREATE INDEX IF NOT EXISTS idx_media_bookmarks_session_id ON media_bookmarks(session_id);
CREATE INDEX IF NOT EXISTS idx_media_bookmarks_source_id ON media_bookmarks(source_id);

-- Learning topic indexes
CREATE INDEX IF NOT EXISTS idx_media_topic_segments_source_id ON media_topic_segments(source_id);
CREATE INDEX IF NOT EXISTS idx_media_topic_segments_topic_id ON media_topic_segments(topic_id);
CREATE INDEX IF NOT EXISTS idx_media_topic_segments_expert_id ON media_topic_segments(expert_id);

-- User preference indexes
CREATE INDEX IF NOT EXISTS idx_user_subject_interests_subject_id ON learn_user_interests(subject_classification_id);
CREATE INDEX IF NOT EXISTS idx_expert_preferences_expert_id ON expert_preferences(expert_id);

-------------------------------------------------------
-- HELPFUL VIEWS - FOR EASY DATA ACCESS
-------------------------------------------------------

-- Media content view with expert information
CREATE OR REPLACE VIEW media_content_view AS
SELECT
  sg.id AS source_id,
  sg.name AS media_name,
  sg.mime_type,
  sg.web_view_link,
  sg.path,
  p.id AS presentation_id,
  p.title AS presentation_title,
  ed.id AS expert_document_id,
  ed.title AS transcript_title,
  CASE 
    WHEN sg.mime_type LIKE 'audio/%' THEN 'audio'
    WHEN sg.mime_type LIKE 'video/%' THEN 'video'
    ELSE 'other'
  END AS media_type,
  sge.expert_id,
  e.expert_name,
  e.full_name AS expert_full_name,
  sc.subject,
  tc.entity_id
FROM
  google_sources sg
LEFT JOIN
  presentations p ON sg.id = p.video_source_id
LEFT JOIN
  google_expert_documents ed ON sg.id = ed.source_id
LEFT JOIN
  google_sources_experts sge ON sg.id = sge.source_id
LEFT JOIN
  experts e ON sge.expert_id = e.id
LEFT JOIN
  table_classifications tc ON tc.entity_id = sg.id AND tc.entity_type = 'google_sources'
LEFT JOIN
  learn_subject_classifications sc ON sc.id = tc.subject_classification_id
WHERE
  sg.mime_type IN ('audio/x-m4a', 'audio/mpeg', 'video/mp4', 'application/vnd.google-apps.video')
  AND sg.is_deleted = false;

-- Session progress view for tracking content completion
CREATE OR REPLACE VIEW session_progress_view AS
SELECT
  ms.id AS session_id,
  ms.source_id,
  sg.name AS media_name,
  ms.app_id,
  ms.media_type,
  ms.started_at,
  ms.completed_at,
  ms.total_play_duration,
  ms.completion_percentage,
  ms.play_count,
  ms.last_position,
  sg.web_view_link,
  p.title AS presentation_title,
  e.expert_name,
  CASE
    WHEN ms.completed_at IS NOT NULL THEN 'completed'
    WHEN ms.total_play_duration > 0 THEN 'in-progress'
    ELSE 'started'
  END AS status
FROM
  media_sessions ms
JOIN
  google_sources sg ON ms.source_id = sg.id
LEFT JOIN
  presentations p ON ms.presentation_id = p.id
LEFT JOIN
  google_sources_experts sge ON sg.id = sge.source_id AND sge.is_primary = true
LEFT JOIN
  experts e ON sge.expert_id = e.id
ORDER BY
  ms.updated_at DESC;