# Database Architecture Evaluation & Recommendations

**Document Location**: `docs/technical-specs/database-architecture-evaluation.md`  
**Created**: May 2025  
**Status**: Current Analysis

## Executive Summary

This document provides a comprehensive evaluation of the DHG database architecture based on the current schema and usage patterns. The analysis identifies strengths, weaknesses, missing components, and provides actionable recommendations for improvement.

## Table of Contents

1. [Architecture Strengths](#architecture-strengths)
2. [Major Issues & Missing Tables](#major-issues--missing-tables)
3. [Tables Requiring Improvements](#tables-requiring-improvements)
4. [Inconsistencies](#inconsistencies)
5. [High-Priority Fixes](#high-priority-fixes)
6. [Tables to Remove](#tables-to-remove)
7. [Missing Features](#missing-features)
8. [Recommended Migration Order](#recommended-migration-order)

## Architecture Strengths

The current database architecture demonstrates several positive design decisions:

1. **Well-organized domain separation** - Clear distinction between different functional areas (auth, media, documents, experts)
2. **Consistent UUID usage** - Good choice for distributed systems and avoiding sequential ID issues
3. **Comprehensive audit trails** - Good tracking with timestamps and user references throughout
4. **Flexible metadata storage** - JSONB fields allow for extensibility without schema changes
5. **Proper normalization** - Most entities are properly separated with appropriate relationships

## Major Issues & Missing Tables

### 1. User Identity Fragmentation

**Current State:**
- `allowed_emails` (3 records) - Being used
- `profiles` (10 records) - Partially used
- `user_profiles` (0 records) - Not used
- `user_profiles_v2` (0 records) - Not used

**Problem:** User data is scattered across multiple tables with no clear primary source of truth.

**Solution:** Consolidate around `allowed_emails` as the primary user identity table.

### 2. Missing Relationship Tables

The following junction tables are needed for many-to-many relationships:

```sql
-- User to Expert relationships (who follows which experts)
CREATE TABLE user_expert_following (
  user_id UUID REFERENCES allowed_emails(id),
  expert_id UUID REFERENCES experts(id),
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, expert_id)
);

-- User to Document bookmarks/favorites
CREATE TABLE user_document_bookmarks (
  user_id UUID REFERENCES allowed_emails(id),
  document_id UUID REFERENCES expert_documents(id),
  bookmarked_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, document_id)
);

-- User to Topic subscriptions
CREATE TABLE user_topic_subscriptions (
  user_id UUID REFERENCES allowed_emails(id),
  topic_id UUID REFERENCES learning_topics(id),
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  notification_preference TEXT DEFAULT 'digest',
  PRIMARY KEY (user_id, topic_id)
);

-- Document to Topic relationships
CREATE TABLE document_topics (
  document_id UUID REFERENCES expert_documents(id),
  topic_id UUID REFERENCES learning_topics(id),
  relevance_score FLOAT DEFAULT 1.0,
  PRIMARY KEY (document_id, topic_id)
);
```

### 3. Missing Core System Tables

```sql
-- Notification system
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES allowed_emails(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity summary (for dashboards)
CREATE TABLE user_activity_summary (
  user_id UUID PRIMARY KEY REFERENCES allowed_emails(id),
  total_documents_viewed INTEGER DEFAULT 0,
  total_videos_watched INTEGER DEFAULT 0,
  total_time_spent_minutes INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  streak_days INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Tables Requiring Improvements

### 1. allowed_emails Table (Primary User Table)

**Missing Fields:**
```sql
ALTER TABLE allowed_emails 
ADD COLUMN last_login_at TIMESTAMPTZ,
ADD COLUMN login_count INTEGER DEFAULT 0,
ADD COLUMN email_verified BOOLEAN DEFAULT false,
ADD COLUMN email_verified_at TIMESTAMPTZ,
ADD COLUMN preferences JSONB DEFAULT '{}',
ADD COLUMN avatar_url TEXT,
ADD COLUMN timezone TEXT DEFAULT 'UTC',
ADD COLUMN locale TEXT DEFAULT 'en-US';
```

### 2. expert_documents Table (731 records)

**Missing Fields:**
```sql
ALTER TABLE expert_documents
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type TEXT,
ADD COLUMN reading_time_minutes INTEGER,
ADD COLUMN is_published BOOLEAN DEFAULT false,
ADD COLUMN published_at TIMESTAMPTZ,
ADD COLUMN view_count INTEGER DEFAULT 0,
ADD COLUMN language TEXT DEFAULT 'en',
ADD COLUMN tags TEXT[],
ADD COLUMN embargo_until TIMESTAMPTZ;
```

### 3. presentations Table (117 records)

**Missing Fields:**
```sql
ALTER TABLE presentations
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN tags TEXT[],
ADD COLUMN is_featured BOOLEAN DEFAULT false,
ADD COLUMN presenter_names TEXT[],
ADD COLUMN presentation_date DATE,
ADD COLUMN language TEXT DEFAULT 'en',
ADD COLUMN difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
ADD COLUMN target_audience TEXT[],
ADD COLUMN slides_url TEXT;
```

### 4. sources_google Table (857 records)

**Missing Fields:**
```sql
ALTER TABLE sources_google
ADD COLUMN sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
ADD COLUMN last_sync_error TEXT,
ADD COLUMN last_sync_at TIMESTAMPTZ,
ADD COLUMN file_hash TEXT,
ADD COLUMN is_archived BOOLEAN DEFAULT false,
ADD COLUMN archive_reason TEXT,
ADD COLUMN processing_priority INTEGER DEFAULT 0;
```

### 5. experts Table (96 records)

**Missing Fields:**
```sql
ALTER TABLE experts
ADD COLUMN bio TEXT,
ADD COLUMN credentials TEXT[],
ADD COLUMN areas_of_expertise TEXT[],
ADD COLUMN profile_image_url TEXT,
ADD COLUMN contact_info JSONB,
ADD COLUMN is_verified BOOLEAN DEFAULT false,
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN follower_count INTEGER DEFAULT 0;
```

## Inconsistencies

### 1. Backup Table Proliferation

**Issue:** Multiple backup tables cluttering the schema:
- `presentations_backup_2025_05_02`
- `expert_documents_backup_2025_05_05`
- `document_types_backup_2025_05_02`
- etc.

**Solution:** Implement proper backup strategy:
1. Move all backup tables to a separate `backup` schema
2. Use point-in-time recovery instead of table copies
3. Implement proper archival procedures

### 2. Naming Inconsistencies

| Issue | Examples | Recommendation |
|-------|----------|----------------|
| Timestamp fields | Some use `created_at/updated_at`, others only `created_at` | All tables should have both |
| Soft delete strategy | Mix of `is_active` and `is_deleted` | Standardize on `is_deleted` |
| User references | Some use `user_id`, others reference different tables | Always reference `allowed_emails.id` |
| Boolean prefixes | Mix of `is_`, `has_`, and no prefix | Standardize on `is_` prefix |

### 3. Empty Core Tables

Critical tables with 0 records despite system activity:

| Table | Purpose | Issue |
|-------|---------|-------|
| `learning_topics` | Core categorization | Feature not implemented |
| `media_sessions` | Video tracking | Integration broken |
| `auth_audit_log` | Security tracking | Not hooked up to auth service |
| `user_profiles_v2` | User preferences | Using wrong table |
| `sources` | Content sources | Replaced by sources_google |

## High-Priority Fixes

### 1. Fix User System (Immediate)

```sql
-- Step 1: Enhance allowed_emails to be the primary user table
ALTER TABLE allowed_emails 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Step 2: Migrate data from profiles table
UPDATE allowed_emails ae
SET 
  metadata = COALESCE(ae.metadata, '{}'::jsonb) || 
    (SELECT row_to_json(p)::jsonb FROM profiles p WHERE p.id = ae.auth_user_id)
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = ae.auth_user_id);

-- Step 3: Update all foreign keys to reference allowed_emails
-- (This requires careful migration of each referencing table)
```

### 2. Add Missing Indexes (Performance)

```sql
-- High-traffic lookups that need indexes
CREATE INDEX IF NOT EXISTS idx_expert_documents_source_id ON expert_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_expert_documents_pipeline_status ON expert_documents(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_expert_documents_document_type_id ON expert_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_presentations_expert_document_id ON presentations(expert_document_id);
CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON allowed_emails(email);
CREATE INDEX IF NOT EXISTS idx_allowed_emails_auth_user_id ON allowed_emails(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_sources_google_drive_id ON sources_google(drive_id);
CREATE INDEX IF NOT EXISTS idx_sources_google_parent_folder_id ON sources_google(parent_folder_id);
```

### 3. Add Cascade Rules (Data Integrity)

```sql
-- Example: Ensure related data is cleaned up
ALTER TABLE expert_documents
DROP CONSTRAINT IF EXISTS expert_documents_source_id_fkey,
ADD CONSTRAINT expert_documents_source_id_fkey 
  FOREIGN KEY (source_id) 
  REFERENCES sources_google(id) 
  ON DELETE CASCADE;

ALTER TABLE presentation_assets
DROP CONSTRAINT IF EXISTS presentation_assets_presentation_id_fkey,
ADD CONSTRAINT presentation_assets_presentation_id_fkey 
  FOREIGN KEY (presentation_id) 
  REFERENCES presentations(id) 
  ON DELETE CASCADE;
```

## Tables to Remove

### 1. Redundant User Tables
- `profiles` - Merge into `allowed_emails`
- `user_profiles` - Not used
- `user_profiles_v2` - Not used

### 2. Backup Tables (Move to separate schema)
- All tables ending in `_backup_YYYY_MM_DD`
- `sync_history_backup`
- `view_backups`

### 3. Unused Tables
- `sources` - Empty, replaced by `sources_google`
- `lionya_emails` - Appears to be test data

### 4. Deprecated Tables
- `document_types_original` - Keep only current version

## Missing Features

Based on the architecture, these features lack database support:

### 1. Notification System
- No way to notify users of new content
- No tracking of what notifications were sent
- No user preferences for notifications

### 2. Content Recommendations
- `user_content_scores` exists but empty
- No algorithm tracking or A/B testing support
- No recommendation feedback loop

### 3. Collaboration Features
- No comments on documents/videos
- No discussion threads
- No sharing mechanisms
- No team/group concepts

### 4. Analytics Infrastructure
- Limited event tracking
- No aggregated metrics tables
- No user cohort analysis support

### 5. Content Versioning
- No version history for documents
- No diff tracking
- No rollback capability

## Recommended Migration Order

### Phase 1: Critical Fixes (Week 1-2)
1. Fix user system consolidation
2. Add missing indexes
3. Hook up auth_audit_log
4. Clean up backup tables

### Phase 2: Data Integrity (Week 3-4)
1. Add missing foreign key constraints
2. Standardize naming conventions
3. Add missing timestamp fields
4. Implement soft delete consistently

### Phase 3: Feature Tables (Week 5-8)
1. Add notification system
2. Implement user-expert relationships
3. Add document bookmarking
4. Create activity tracking tables

### Phase 4: Enhancement (Week 9-12)
1. Add missing fields to core tables
2. Implement content versioning
3. Add collaboration features
4. Build analytics infrastructure

## Monitoring & Maintenance

### Regular Reviews
- Weekly: Check for orphaned records
- Monthly: Review index usage
- Quarterly: Analyze table growth patterns

### Performance Monitoring
```sql
-- Query to find tables without primary keys
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT IN (
  SELECT table_name 
  FROM information_schema.table_constraints 
  WHERE constraint_type = 'PRIMARY KEY'
);

-- Query to find missing indexes on foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND NOT EXISTS (
  SELECT 1
  FROM pg_indexes
  WHERE tablename = tc.table_name
  AND indexdef LIKE '%' || kcu.column_name || '%'
);
```

## Conclusion

The database architecture has a solid foundation but needs consolidation and enhancement. The priority should be:

1. **Consolidate user system** - Critical for all features
2. **Add missing relationships** - Enable core functionality
3. **Improve performance** - Add indexes and optimize queries
4. **Enable new features** - Add tables for notifications, recommendations, etc.

By following this plan, the system will be more maintainable, performant, and ready for future growth.