# DHG System Implementation Roadmap: Priorities & Practical Steps

## Table of Contents

1. [Introduction](#introduction)
2. [Implementation Priorities](#implementation-priorities)
3. [Staged Implementation Plan](#staged-implementation-plan)
   - [Stage 1: Foundation Improvements](#stage-1-foundation-improvements)
   - [Stage 2: Enhanced Search & Basic Knowledge Features](#stage-2-enhanced-search--basic-knowledge-features)
   - [Stage 3: Advanced AI Integration](#stage-3-advanced-ai-integration)
   - [Stage 4: Collaboration & Learning Features](#stage-4-collaboration--learning-features)
   - [Stage 5: Architecture Evolution](#stage-5-architecture-evolution)
4. [Frontend Usage Tracking Implementation](#frontend-usage-tracking-implementation)
   - [Tracking Strategy](#tracking-strategy)
   - [Database Schema](#database-schema)
   - [Implementation Approach](#implementation-approach)
   - [Event Types to Track](#event-types-to-track)
   - [Privacy Considerations](#privacy-considerations)
5. [User Annotation System](#user-annotation-system)
   - [Annotation Types](#annotation-types)
   - [Database Schema](#annotation-database-schema)
   - [Implementation Approach](#annotation-implementation-approach)
   - [AI-Enhanced Features](#ai-enhanced-features)
6. [Decision Making Framework](#decision-making-framework)
7. [Success Metrics](#success-metrics)

## Introduction

This document provides a prioritized implementation roadmap for the DHG Knowledge System, focusing on practical steps that can be taken incrementally without overwhelming development resources. Instead of implementing all recommendations at once, this guide outlines a staged approach with clear indicators for when to move to the next stage.

The roadmap addresses three key aspects:
1. **Prioritization of architectural improvements**
2. **Frontend usage tracking implementation**
3. **User annotation capabilities**

Each section includes practical implementation steps, database schemas, and guidance on when to start each phase.

## Implementation Priorities

When evaluating which features to implement first, consider these priority factors:

### High Priority (Immediate Value)
- Features that directly improve user experience
- Capabilities that address current performance bottlenecks
- Functions that enable better content discovery
- Features that provide valuable insights into system usage

### Medium Priority (Near-term Value)
- Features that enhance content organization
- Capabilities that improve developer productivity
- Functions that prepare for future scaling
- Innovations that differentiate your platform

### Low Priority (Future Potential)
- Advanced architectural changes without immediate need
- Features requiring significant infrastructure investment
- Capabilities dependent on high user adoption
- Functions that can be effectively outsourced initially

### Priority Matrix for Key Features

| Feature | Priority | Complexity | Value | When to Implement |
|---------|----------|------------|-------|--------------------|
| PostgreSQL Full-Text Search | High | Low | High | Immediately |
| Frontend Usage Tracking | High | Medium | High | Immediately |
| Basic Annotation System | High | Medium | High | Within 1-2 months |
| Entity Extraction | Medium | Medium | Medium | Within 3-6 months |
| Semantic Search | Medium | Medium | High | Within 3-4 months |
| Video Content Analysis | Medium | High | Medium | Within 6-9 months |
| Knowledge Graph | Medium | High | High | Within 6-12 months |
| Elasticsearch Integration | Low | High | Medium | When document count exceeds 100K |
| Microservices Evolution | Low | High | Medium | When specific scaling issues arise |

## Staged Implementation Plan

### Stage 1: Foundation Improvements
**Timeframe:** 1-2 months  
**Focus:** Immediate improvements with high value and relatively low complexity

#### Key Implementations:

1. **PostgreSQL Full-Text Search**
   - Add full-text search capabilities to your Supabase database
   - Implement basic search interface in the frontend
   - Start indexing document content during processing

   ```sql
   -- Add full-text search capabilities to documents table
   ALTER TABLE documents ADD COLUMN document_fts tsvector 
   GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED;
   
   CREATE INDEX document_fts_idx ON documents USING GIN (document_fts);
   ```

2. **Frontend Usage Tracking**
   - Implement event tracking in your React frontend
   - Create database tables for storing user interactions
   - Build basic analytics dashboard for usage insights

3. **Document Processing Optimizations**
   - Improve error handling in document processing pipeline
   - Add better logging and monitoring
   - Implement basic caching for frequently accessed documents

#### When to Move to Stage 2:
- At least 50 users actively using the system
- More than 1,000 documents processed
- Basic search functionality implemented and functional
- Usage tracking providing actionable insights

### Stage 2: Enhanced Search & Basic Knowledge Features
**Timeframe:** 3-6 months  
**Focus:** Improving content discovery and beginning knowledge extraction

#### Key Implementations:

1. **Basic Annotation System**
   - Implement user annotations for documents and videos
   - Create database schema for storing annotations
   - Build UI components for creating and viewing annotations

2. **Semantic Search Implementation**
   - Add vector embeddings for documents
   - Implement similarity search functionality
   - Create hybrid search combining full-text and semantic approaches

   ```typescript
   // In SearchService
   async function hybridSearch(query: string): Promise<SearchResult[]> {
     // Get embedding for query
     const queryEmbedding = await getEmbedding(query);
     
     // Perform semantic search
     const semanticResults = await performSemanticSearch(queryEmbedding);
     
     // Perform full-text search
     const textResults = await performFullTextSearch(query);
     
     // Combine and rank results
     return combineAndRankResults(semanticResults, textResults);
   }
   ```

3. **Basic Entity Extraction**
   - Implement entity extraction using Claude AI
   - Create database schema for storing entities
   - Build basic entity browsing interface

#### When to Move to Stage 3:
- Users actively using search features (>10 searches per user per week)
- Annotation system being used by at least 25% of users
- Document count exceeds 5,000
- Feedback indicates need for more sophisticated content analysis

### Stage 3: Advanced AI Integration
**Timeframe:** 6-12 months  
**Focus:** Deeper content analysis and AI-enhanced features

#### Key Implementations:

1. **Enhanced Entity and Relationship Extraction**
   - Implement more sophisticated entity extraction
   - Extract relationships between entities
   - Build database schema for entity relationships

2. **Therapeutic Protocol Extraction**
   - Implement specialized extraction for therapeutic protocols
   - Create structured representation of protocols
   - Build protocol comparison interface

3. **Video Content Analysis**
   - Implement video segmentation and topic extraction
   - Extract Q&A segments from videos
   - Create chapter markers for video navigation

#### When to Move to Stage 4:
- Entity extraction producing valuable insights
- Users engaging with extracted entities (>5 entity clicks per session)
- Video content analysis improving user engagement with video content
- System processing >50 new documents per week

### Stage 4: Collaboration & Learning Features
**Timeframe:** 12-18 months  
**Focus:** Enhanced user collaboration and educational features

#### Key Implementations:

1. **Advanced Annotation and Discussion**
   - Implement collaborative annotations
   - Add discussion threads linked to content
   - Create notification system for annotation activity

2. **Knowledge Graph Visualization**
   - Build interactive knowledge graph interface
   - Implement concept navigation through the graph
   - Create personalized concept maps for users

3. **Learning Assessment Tools**
   - Implement AI-generated quizzes based on content
   - Create learning progress tracking
   - Build spaced repetition system for key concepts

#### When to Move to Stage 5:
- Active collaboration between users (>10 comments/annotations per active user per week)
- Knowledge graph navigation being actively used
- Learning assessment tools showing measurable learning outcomes
- Scaling or performance issues beginning to emerge

### Stage 5: Architecture Evolution
**Timeframe:** 18+ months  
**Focus:** Scaling the system for larger user base and content volume

#### Key Implementations:

1. **Elasticsearch Integration**
   - Implement for improved search as document count grows
   - Set up proper index management and synchronization
   - Enhance search with Elasticsearch-specific capabilities

2. **Microservices Evolution**
   - Begin with extracting the Claude AI service
   - Implement proper service discovery and communication
   - Gradually migrate other services as needed

3. **Advanced Analytics and Personalization**
   - Implement machine learning for content recommendations
   - Create personalized learning paths
   - Build predictive analytics for user behavior

## Frontend Usage Tracking Implementation

Implementing frontend tracking is crucial for understanding how users interact with your application and making data-driven improvements.

### Tracking Strategy

The recommended approach employs:
1. **Event-Based Tracking**: Capturing specific user interactions
2. **Session Tracking**: Understanding user journeys through the application
3. **Resource Engagement**: Measuring how users engage with specific content
4. **Performance Metrics**: Capturing application performance data

### Database Schema

```sql
-- User sessions table
CREATE TABLE user_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  device_info JSONB,
  browser_info JSONB,
  referrer TEXT,
  entry_page TEXT
);

-- User events table
CREATE TABLE user_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES user_sessions(session_id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  page_path TEXT,
  component_id TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource engagement table
CREATE TABLE resource_engagement (
  engagement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(session_id),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  engagement_duration INTEGER,
  engagement_depth FLOAT,
  engagement_actions JSONB
);

-- Create indexes for frequent queries
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_session_id ON user_events(session_id);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_resource_engagement_resource_id ON resource_engagement(resource_id);
```

### Implementation Approach

1. **Create a Tracking Service in your Frontend**:

```typescript
// src/services/tracking-service.ts
import { createClient } from '@supabase/supabase-js';

class TrackingService {
  private static instance: TrackingService;
  private supabase: any;
  private sessionId: string | null = null;
  private isInitialized: boolean = false;
  
  private constructor() {
    this.supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL || '',
      process.env.REACT_APP_SUPABASE_ANON_KEY || ''
    );
  }
  
  public static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }
  
  public async initializeSession(userId: string): Promise<void> {
    if (this.isInitialized) return;
    
    // Collect browser information
    const deviceInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };
    
    // Create session
    const { data, error } = await this.supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        device_info: deviceInfo,
        browser_info: { name: this.getBrowserName() },
        referrer: document.referrer,
        entry_page: window.location.pathname
      })
      .select();
    
    if (error) {
      console.error('Failed to initialize tracking session:', error);
      return;
    }
    
    this.sessionId = data[0].session_id;
    this.isInitialized = true;
    
    // Set up before unload event to end session
    window.addEventListener('beforeunload', () => this.endSession());
  }
  
  public async trackEvent(eventType: string, eventData: any = {}, componentId?: string): Promise<void> {
    if (!this.sessionId) return;
    
    await this.supabase
      .from('user_events')
      .insert({
        session_id: this.sessionId,
        user_id: this.getUserId(),
        event_type: eventType,
        event_data: eventData,
        page_path: window.location.pathname,
        component_id: componentId
      });
  }
  
  public async startResourceEngagement(resourceType: string, resourceId: string): Promise<string> {
    if (!this.sessionId) return '';
    
    const { data, error } = await this.supabase
      .from('resource_engagement')
      .insert({
        user_id: this.getUserId(),
        session_id: this.sessionId,
        resource_type: resourceType,
        resource_id: resourceId
      })
      .select();
    
    if (error) {
      console.error('Failed to start resource engagement:', error);
      return '';
    }
    
    return data[0].engagement_id;
  }
  
  public async endResourceEngagement(
    engagementId: string,
    engagementDepth: number = 0,
    actions: any = {}
  ): Promise<void> {
    if (!engagementId) return;
    
    const { data } = await this.supabase
      .from('resource_engagement')
      .select('started_at')
      .eq('engagement_id', engagementId);
    
    if (!data || data.length === 0) return;
    
    const startTime = new Date(data[0].started_at).getTime();
    const endTime = new Date().getTime();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    await this.supabase
      .from('resource_engagement')
      .update({
        ended_at: new Date().toISOString(),
        engagement_duration: durationSeconds,
        engagement_depth: engagementDepth,
        engagement_actions: actions
      })
      .eq('engagement_id', engagementId);
  }
  
  private async endSession(): Promise<void> {
    if (!this.sessionId) return;
    
    await this.supabase
      .from('user_sessions')
      .update({
        ended_at: new Date().toISOString()
      })
      .eq('session_id', this.sessionId);
    
    this.sessionId = null;
    this.isInitialized = false;
  }
  
  private getUserId(): string {
    // Get user ID from your authentication system
    return this.supabase.auth.getUser()?.id || '';
  }
  
  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) return "Internet Explorer";
    if (userAgent.indexOf("Edge") > -1) return "Edge";
    return "Unknown";
  }
}

export const trackingService = TrackingService.getInstance();
```

2. **Track Video Interactions**:

```typescript
// src/components/VideoPlayer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { trackingService } from '../services/tracking-service';

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  title: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, videoUrl, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [engagementId, setEngagementId] = useState<string>('');
  const [playbackPositions, setPlaybackPositions] = useState<number[]>([]);
  const [watchedSegments, setWatchedSegments] = useState<[number, number][]>([]);
  
  useEffect(() => {
    return () => {
      if (engagementId) {
        // Calculate engagement depth (percentage of video watched)
        const videoDuration = videoRef.current?.duration || 0;
        let totalWatchedSeconds = 0;
        
        // Sum up all watched segments
        watchedSegments.forEach(([start, end]) => {
          totalWatchedSeconds += (end - start);
        });
        
        const engagementDepth = videoDuration > 0 ? (totalWatchedSeconds / videoDuration) : 0;
        
        // End the engagement tracking when component unmounts
        trackingService.endResourceEngagement(engagementId, engagementDepth, {
          playback_positions: playbackPositions,
          watched_segments: watchedSegments
        });
      }
    };
  }, [engagementId, playbackPositions, watchedSegments]);
  
  const handlePlay = async () => {
    if (!engagementId) {
      const id = await trackingService.startResourceEngagement('video', videoId);
      setEngagementId(id);
    }
    
    trackingService.trackEvent('video_play', { 
      video_id: videoId,
      position: videoRef.current?.currentTime || 0,
      title: title
    });
    
    // Start tracking watched segment
    const currentTime = videoRef.current?.currentTime || 0;
    setWatchedSegments(prev => [...prev, [currentTime, currentTime]]);
  };
  
  const handlePause = () => {
    trackingService.trackEvent('video_pause', { 
      video_id: videoId,
      position: videoRef.current?.currentTime || 0
    });
    
    // End current watched segment
    const currentTime = videoRef.current?.currentTime || 0;
    setWatchedSegments(prev => {
      const newSegments = [...prev];
      if (newSegments.length > 0) {
        const lastIndex = newSegments.length - 1;
        newSegments[lastIndex] = [newSegments[lastIndex][0], currentTime];
      }
      return newSegments;
    });
  };
  
  const handleTimeUpdate = () => {
    // Record position every 5 seconds
    const currentTime = Math.floor(videoRef.current?.currentTime || 0);
    if (currentTime % 5 === 0 && !playbackPositions.includes(currentTime)) {
      setPlaybackPositions(prev => [...prev, currentTime]);
    }
    
    // Update current watched segment
    setWatchedSegments(prev => {
      if (prev.length === 0) return prev;
      
      const newSegments = [...prev];
      const lastIndex = newSegments.length - 1;
      newSegments[lastIndex] = [newSegments[lastIndex][0], currentTime];
      return newSegments;
    });
  };
  
  const handleSeek = () => {
    trackingService.trackEvent('video_seek', { 
      video_id: videoId,
      position: videoRef.current?.currentTime || 0
    });
    
    // End current watched segment and start a new one
    const currentTime = videoRef.current?.currentTime || 0;
    setWatchedSegments(prev => {
      const newSegments = [...prev];
      if (newSegments.length > 0) {
        const lastIndex = newSegments.length - 1;
        newSegments[lastIndex] = [newSegments[lastIndex][0], currentTime];
      }
      return [...newSegments, [currentTime, currentTime]];
    });
  };
  
  return (
    <div className="video-player">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onSeeked={handleSeek}
      />
    </div>
  );
};

export default VideoPlayer;
```

3. **Track Document Interactions**:

```typescript
// src/components/DocumentViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import { trackingService } from '../services/tracking-service';

interface DocumentViewerProps {
  documentId: string;
  documentUrl: string;
  title: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, documentUrl, title }) => {
  const [engagementId, setEngagementId] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPositions, setScrollPositions] = useState<number[]>([]);
  const [visibleTime, setVisibleTime] = useState<number>(0);
  const [lastVisibilityCheck, setLastVisibilityCheck] = useState<number>(Date.now());
  const [isVisible, setIsVisible] = useState<boolean>(false);
  
  // Start tracking when document is loaded
  useEffect(() => {
    const startTracking = async () => {
      trackingService.trackEvent('document_view', { document_id: documentId, title });
      const id = await trackingService.startResourceEngagement('document', documentId);
      setEngagementId(id);
    };
    
    startTracking();
    
    return () => {
      if (engagementId) {
        // Calculate engagement depth (percentage of document viewed)
        const containerHeight = containerRef.current?.scrollHeight || 1;
        const uniquePositions = new Set(scrollPositions);
        const visibleHeight = 800; // Approximate visible height in pixels
        
        // Estimate percentage viewed based on unique scroll positions
        const pixelsViewed = uniquePositions.size * visibleHeight;
        const engagementDepth = Math.min(pixelsViewed / containerHeight, 1);
        
        // End the engagement tracking when component unmounts
        trackingService.endResourceEngagement(engagementId, engagementDepth, {
          scroll_positions: Array.from(uniquePositions),
          visible_time_seconds: visibleTime
        });
      }
    };
  }, [documentId, title, engagementId, scrollPositions, visibleTime]);
  
  // Track scroll events
  useEffect(() => {
    const handleScroll = () => {
      const position = Math.floor(containerRef.current?.scrollTop || 0);
      setScrollPositions(prev => [...prev, position]);
      
      trackingService.trackEvent('document_scroll', { 
        document_id: documentId, 
        position: position
      });
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [documentId]);
  
  // Track visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      
      if (isVisible) {
        // Document was visible and is now hidden
        const timeVisible = now - lastVisibilityCheck;
        setVisibleTime(prev => prev + (timeVisible / 1000));
      }
      
      setIsVisible(!document.hidden);
      setLastVisibilityCheck(now);
    };
    
    // Initialize visibility
    setIsVisible(!document.hidden);
    setLastVisibilityCheck(Date.now());
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isVisible, lastVisibilityCheck]);
  
  return (
    <div 
      ref={containerRef}
      className="document-viewer-container"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <iframe 
        src={documentUrl} 
        title={title}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => trackingService.trackEvent('document_loaded', { document_id: documentId })}
      />
    </div>
  );
};

export default DocumentViewer;
```

### Event Types to Track

1. **Navigation Events**:
   - Page views
   - Navigation between sections
   - Search queries

2. **Content Interaction Events**:
   - Document views
   - Video playback (play, pause, seek, complete)
   - Downloads
   - Sharing actions

3. **Feature Usage Events**:
   - Search usage
   - Filter application
   - Sorting changes
   - Annotation creation/editing

4. **Technical Events**:
   - Page load times
   - Error occurrences
   - API call latencies

### Privacy Considerations

1. Be transparent about tracking in your privacy policy
2. Allow users to opt out of non-essential tracking
3. Anonymize sensitive data where possible
4. Implement proper data retention policies
5. Consider GDPR and other privacy regulations

## User Annotation System

An annotation system allows users to add notes, highlights, and comments to documents and videos, enhancing learning and collaboration.

### Annotation Types

1. **Text Highlights**: Selecting and highlighting text in documents
2. **Text Notes**: Adding comments to specific parts of documents
3. **Video Timestamps**: Adding notes at specific points in videos
4. **Video Segments**: Marking important segments of videos
5. **Concept Tags**: Tagging content with relevant concepts

<a id="annotation-database-schema"></a>
### Database Schema

```sql
-- Annotations table
CREATE TABLE annotations (
  annotation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  resource_type TEXT NOT NULL, -- 'document', 'video', etc.
  resource_id UUID NOT NULL,
  annotation_type TEXT NOT NULL, -- 'highlight', 'note', 'timestamp', 'segment', 'tag'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_private BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Text annotations (for documents)
CREATE TABLE text_annotations (
  annotation_id UUID PRIMARY KEY REFERENCES annotations(annotation_id),
  text_content TEXT,
  selection_path JSONB, -- JSON path to selected text
  selection_text TEXT,   -- The actual text that was selected
  start_offset INTEGER,  -- Character offset in the document
  end_offset INTEGER,    -- Character offset in the document
  color TEXT             -- Highlight color
);

-- Video annotations
CREATE TABLE video_annotations (
  annotation_id UUID PRIMARY KEY REFERENCES annotations(annotation_id),
  text_content TEXT,
  timestamp_seconds FLOAT, -- For timestamp annotations
  start_time FLOAT,       -- For segment annotations
  end_time FLOAT,         -- For segment annotations
  color TEXT              -- Visual indicator color
);

-- Concept tags
CREATE TABLE concept_tags (
  tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID REFERENCES annotations(annotation_id),
  concept_name TEXT NOT NULL,
  confidence FLOAT,       -- For AI-suggested tags
  is_ai_generated BOOLEAN DEFAULT FALSE
);

-- Annotation replies (for collaboration)
CREATE TABLE annotation_replies (
  reply_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID REFERENCES annotations(annotation_id),
  user_id UUID REFERENCES auth.users(id),
  reply_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX idx_annotations_user_id ON annotations(user_id);
CREATE INDEX idx_annotations_resource ON annotations(resource_type, resource_id);
CREATE INDEX idx_concept_tags_name ON concept_tags(concept_name);
```

<a id="annotation-implementation-approach"></a>
### Implementation Approach

1. **Create an Annotation Service**:

```typescript
// src/services/annotation-service.ts
import { createClient } from '@supabase/supabase-js';

class AnnotationService {
  private static instance: AnnotationService;
  private supabase: any;
  
  private constructor() {
    this.supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL || '',
      process.env.REACT_APP_SUPABASE_ANON_KEY || ''
    );
  }
  
  public static getInstance(): AnnotationService {
    if (!AnnotationService.instance) {
      AnnotationService.instance = new AnnotationService();
    }
    return AnnotationService.instance;
  }
  
  public async createTextAnnotation(
    userId: string,
    resourceId: string,
    selectionText: string,
    startOffset: number,
    endOffset: number,
    textContent: string = '',
    isPrivate: boolean = true,
    color: string = 'yellow'
  ): Promise<string> {
    // First create the base annotation
    const { data: annotationData, error: annotationError } = await this.supabase
      .from('annotations')
      .insert({
        user_id: userId,
        resource_type: 'document',
        resource_id: resourceId,
        annotation_type: 'highlight',
        is_private: isPrivate
      })
      .select();
    
    if (annotationError || !annotationData) {
      console.error('Failed to create annotation:', annotationError);
      throw new Error('Failed to create annotation');
    }
    
    const annotationId = annotationData[0].annotation_id;
    
    // Then create the text annotation
    const { error: textError } = await this.supabase
      .from('text_annotations')
      .insert({
        annotation_id: annotationId,
        text_content: textContent,
        selection_text: selectionText,
        start_offset: startOffset,
        end_offset: endOffset,
        color: color
      });
    
    if (textError) {
      console.error('Failed to create text annotation:', textError);
      throw new Error('Failed to create text annotation');
    }
    
    return annotationId;
  }
  
  public async createVideoAnnotation(
    userId: string,
    resourceId: string,
    timestamp: number,
    textContent: string,
    isPrivate: boolean = true,
    color: string = 'blue'
  ): Promise<string> {
    // Create base annotation
    const { data: annotationData, error: annotationError } = await this.supabase
      .from('annotations')
      .insert({
        user_id: userId,
        resource_type: 'video',
        resource_id: resourceId,
        annotation_type: 'timestamp',
        is_private: isPrivate
      })
      .select();
    
    if (annotationError || !annotationData) {
      console.error('Failed to create annotation:', annotationError);
      throw new Error('Failed to create annotation');
    }
    
    const annotationId = annotationData[0].annotation_id;
    
    // Create video annotation
    const { error: videoError } = await this.supabase
      .from('video_annotations')
      .insert({
        annotation_id: annotationId,
        text_content: textContent,
        timestamp_seconds: timestamp,
        color: color
      });
    
    if (videoError) {
      console.error('Failed to create video annotation:', videoError);
      throw new Error('Failed to create video annotation');
    }
    
    return annotationId;
  }
  
  public async createVideoSegmentAnnotation(
    userId: string,
    resourceId: string,
    startTime: number,
    endTime: number,
    textContent: string,
    isPrivate: boolean = true,
    color: string = 'green'
  ): Promise<string> {
    // Create base annotation
    const { data: annotationData, error: annotationError } = await this.supabase
      .from('annotations')
      .insert({
        user_id: userId,
        resource_type: 'video',
        resource_id: resourceId,
        annotation_type: 'segment',
        is_private: isPrivate
      })
      .select();
    
    if (annotationError || !annotationData) {
      console.error('Failed to create annotation:', annotationError);
      throw new Error('Failed to create annotation');
    }
    
    const annotationId = annotationData[0].annotation_id;
    
    // Create video segment annotation
    const { error: videoError } = await this.supabase
      .from('video_annotations')
      .insert({
        annotation_id: annotationId,
        text_content: textContent,
        start_time: startTime,
        end_time: endTime,
        color: color
      });
    
    if (videoError) {
      console.error('Failed to create video segment annotation:', videoError);
      throw new Error('Failed to create video segment annotation');
    }
    
    return annotationId;
  }
  
  public async addConceptTag(
    annotationId: string,
    conceptName: string,
    isAiGenerated: boolean = false,
    confidence: number = 1.0
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('concept_tags')
      .insert({
        annotation_id: annotationId,
        concept_name: conceptName,
        is_ai_generated: isAiGenerated,
        confidence: confidence
      })
      .select();
    
    if (error) {
      console.error('Failed to add concept tag:', error);
      throw new Error('Failed to add concept tag');
    }
    
    return data[0].tag_id;
  }
  
  public async getAnnotationsForResource(
    resourceType: string,
    resourceId: string,
    userId?: string
  ): Promise<any[]> {
    let query = this.supabase
      .from('annotations')
      .select(`
        *,
        text_annotations(*),
        video_annotations(*),
        concept_tags(*)
      `)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('is_deleted', false);
    
    // If userId is provided, filter by user and include private annotations
    // Otherwise, only include public annotations
    if (userId) {
      query = query.or(`is_private.eq.false,user_id.eq.${userId}`);
    } else {
      query = query.eq('is_private', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to get annotations:', error);
      throw new Error('Failed to get annotations');
    }
    
    return data;
  }
  
  public async addReplyToAnnotation(
    annotationId: string,
    userId: string,
    replyText: string
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('annotation_replies')
      .insert({
        annotation_id: annotationId,
        user_id: userId,
        reply_text: replyText
      })
      .select();
    
    if (error) {
      console.error('Failed to add reply:', error);
      throw new Error('Failed to add reply');
    }
    
    return data[0].reply_id;
  }
  
  public async updateAnnotation(
    annotationId: string,
    userId: string,
    updates: any
  ): Promise<void> {
    // First check if user owns the annotation
    const { data, error } = await this.supabase
      .from('annotations')
      .select('user_id')
      .eq('annotation_id', annotationId)
      .single();
    
    if (error) {
      console.error('Failed to fetch annotation:', error);
      throw new Error('Failed to fetch annotation');
    }
    
    if (data.user_id !== userId) {
      throw new Error('Cannot update annotation: not owned by user');
    }
    
    // Handle different annotation types
    if (updates.text_content !== undefined) {
      if (updates.annotation_type === 'highlight') {
        await this.supabase
          .from('text_annotations')
          .update({ text_content: updates.text_content })
          .eq('annotation_id', annotationId);
      } else if (['timestamp', 'segment'].includes(updates.annotation_type)) {
        await this.supabase
          .from('video_annotations')
          .update({ text_content: updates.text_content })
          .eq('annotation_id', annotationId);
      }
    }
    
    // Update color if provided
    if (updates.color !== undefined) {
      if (updates.annotation_type === 'highlight') {
        await this.supabase
          .from('text_annotations')
          .update({ color: updates.color })
          .eq('annotation_id', annotationId);
      } else if (['timestamp', 'segment'].includes(updates.annotation_type)) {
        await this.supabase
          .from('video_annotations')
          .update({ color: updates.color })
          .eq('annotation_id', annotationId);
      }
    }
    
    // Update privacy setting if provided
    if (updates.is_private !== undefined) {
      await this.supabase
        .from('annotations')
        .update({ is_private: updates.is_private })
        .eq('annotation_id', annotationId);
    }
  }
  
  public async deleteAnnotation(
    annotationId: string,
    userId: string
  ): Promise<void> {
    // First check if user owns the annotation
    const { data, error } = await this.supabase
      .from('annotations')
      .select('user_id')
      .eq('annotation_id', annotationId)
      .single();
    
    if (error) {
      console.error('Failed to fetch annotation:', error);
      throw new Error('Failed to fetch annotation');
    }
    
    if (data.user_id !== userId) {
      throw new Error('Cannot delete annotation: not owned by user');
    }
    
    // Soft delete by setting is_deleted flag
    await this.supabase
      .from('annotations')
      .update({ is_deleted: true })
      .eq('annotation_id', annotationId);
  }
}

export const annotationService = AnnotationService.getInstance();
```

2. **Create a Document Annotation Component**:

```typescript
// src/components/DocumentAnnotator.tsx
import React, { useEffect, useState } from 'react';
import { annotationService } from '../services/annotation-service';
import { trackingService } from '../services/tracking-service';

interface DocumentAnnotatorProps {
  documentId: string;
  userId: string;
  containerRef: React.RefObject<HTMLElement>;
}

const DocumentAnnotator: React.FC<DocumentAnnotatorProps> = ({ 
  documentId, 
  userId,
  containerRef
}) => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [showAddNoteForm, setShowAddNoteForm] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [highlightColor, setHighlightColor] = useState<string>('yellow');
  
  // Load existing annotations
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const data = await annotationService.getAnnotationsForResource('document', documentId, userId);
        setAnnotations(data);
      } catch (error) {
        console.error('Error loading annotations:', error);
      }
    };
    
    loadAnnotations();
  }, [documentId, userId]);
  
  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectedText('');
        setSelectionRange(null);
        return;
      }
      
      const range = selection.getRangeAt(0);
      const container = containerRef.current;
      
      // Make sure the selection is within our container
      if (container && container.contains(range.commonAncestorContainer)) {
        setSelectedText(range.toString());
        setSelectionRange(range);
      } else {
        setSelectedText('');
        setSelectionRange(null);
      }
    };
    
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [containerRef]);
  
  // Create a highlight annotation
  const createHighlight = async (withNote: boolean = false) => {
    if (!selectionRange || !selectedText) return;
    
    try {
      // Get start and end offsets
      const startOffset = getOffsetInDocument(selectionRange.startContainer, selectionRange.startOffset);
      const endOffset = getOffsetInDocument(selectionRange.endContainer, selectionRange.endOffset);
      
      // Get selection path (for future reference)
      const selectionPath = getSelectionPath(selectionRange);
      
      let note = '';
      if (withNote) {
        setShowAddNoteForm(true);
      } else {
        // Create the highlight annotation
        const annotationId = await annotationService.createTextAnnotation(
          userId,
          documentId,
          selectedText,
          startOffset,
          endOffset,
          note,
          true, // Private by default
          highlightColor
        );
        
        // Track the annotation creation
        trackingService.trackEvent('create_annotation', {
          annotation_type: 'highlight',
          document_id: documentId,
          text_length: selectedText.length
        });
        
        // Clear selection
        window.getSelection()?.removeAllRanges();
        setSelectedText('');
        setSelectionRange(null);
        
        // Refresh annotations
        const data = await annotationService.getAnnotationsForResource('document', documentId, userId);
        setAnnotations(data);
      }
    } catch (error) {
      console.error('Error creating highlight:', error);
    }
  };
  
  // Save note with highlight
  const saveNote = async () => {
    if (!selectionRange || !selectedText) return;
    
    try {
      // Get start and end offsets
      const startOffset = getOffsetInDocument(selectionRange.startContainer, selectionRange.startOffset);
      const endOffset = getOffsetInDocument(selectionRange.endContainer, selectionRange.endOffset);
      
      // Create the highlight annotation with note
      const annotationId = await annotationService.createTextAnnotation(
        userId,
        documentId,
        selectedText,
        startOffset,
        endOffset,
        noteText,
        true, // Private by default
        highlightColor
      );
      
      // Track the annotation creation
      trackingService.trackEvent('create_annotation', {
        annotation_type: 'note',
        document_id: documentId,
        text_length: selectedText.length,
        note_length: noteText.length
      });
      
      // Clear selection and form
      window.getSelection()?.removeAllRanges();
      setSelectedText('');
      setSelectionRange(null);
      setNoteText('');
      setShowAddNoteForm(false);
      
      // Refresh annotations
      const data = await annotationService.getAnnotationsForResource('document', documentId, userId);
      setAnnotations(data);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };
  
  // Helper function to get offset in document
  const getOffsetInDocument = (node: Node, offset: number): number => {
    // Implementation to calculate absolute offset in document
    // This is a simplified placeholder - real implementation would traverse the DOM
    return 0;
  };
  
  // Helper function to get selection path for future reference
  const getSelectionPath = (range: Range): any => {
    // Implementation to create a path to the selection for future rendering
    // This is a simplified placeholder
    return {};
  };
  
  // Render annotations on the document
  const renderAnnotations = () => {
    // Implementation to render highlights and notes on the document
    // This would involve inserting highlight spans into the DOM
    // or creating overlay elements for notes
  };
  
  useEffect(() => {
    if (annotations.length > 0) {
      renderAnnotations();
    }
  }, [annotations]);
  
  return (
    <div className="document-annotator">
      {selectedText && !showAddNoteForm && (
        <div className="annotation-toolbar">
          <button onClick={() => createHighlight(false)}>Highlight</button>
          <button onClick={() => createHighlight(true)}>Add Note</button>
          <select 
            value={highlightColor} 
            onChange={(e) => setHighlightColor(e.target.value)}
          >
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="pink">Pink</option>
          </select>
        </div>
      )}
      
      {showAddNoteForm && (
        <div className="add-note-form">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your note here..."
          />
          <div className="form-actions">
            <button onClick={saveNote}>Save</button>
            <button onClick={() => setShowAddNoteForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentAnnotator;
```

3. **Create a Video Annotation Component**:

```typescript
// src/components/VideoAnnotator.tsx
import React, { useEffect, useRef, useState } from 'react';
import { annotationService } from '../services/annotation-service';
import { trackingService } from '../services/tracking-service';

interface VideoAnnotatorProps {
  videoId: string;
  userId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoAnnotator: React.FC<VideoAnnotatorProps> = ({ 
  videoId, 
  userId,
  videoRef
}) => {
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [showAddNoteForm, setShowAddNoteForm] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isRecordingSegment, setIsRecordingSegment] = useState<boolean>(false);
  const [segmentStart, setSegmentStart] = useState<number>(0);
  
  // Load existing annotations
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const data = await annotationService.getAnnotationsForResource('video', videoId, userId);
        setAnnotations(data);
      } catch (error) {
        console.error('Error loading annotations:', error);
      }
    };
    
    loadAnnotations();
  }, [videoId, userId]);
  
  // Update current time
  useEffect(() => {
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };
    
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
      return () => videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [videoRef]);
  
  // Create a timestamp annotation
  const createTimestampAnnotation = () => {
    setShowAddNoteForm(true);
  };
  
  // Save timestamp note
  const saveTimestampNote = async () => {
    try {
      // Create the timestamp annotation
      const annotationId = await annotationService.createVideoAnnotation(
        userId,
        videoId,
        currentTime,
        noteText,
        true // Private by default
      );
      
      // Track the annotation creation
      trackingService.trackEvent('create_annotation', {
        annotation_type: 'video_timestamp',
        video_id: videoId,
        timestamp: currentTime,
        note_length: noteText.length
      });
      
      // Clear form
      setNoteText('');
      setShowAddNoteForm(false);
      
      // Refresh annotations
      const data = await annotationService.getAnnotationsForResource('video', videoId, userId);
      setAnnotations(data);
    } catch (error) {
      console.error('Error creating timestamp annotation:', error);
    }
  };
  
  // Start recording a segment
  const startSegmentRecording = () => {
    setSegmentStart(currentTime);
    setIsRecordingSegment(true);
  };
  
  // End recording a segment and show note form
  const endSegmentRecording = () => {
    setIsRecordingSegment(false);
    setShowAddNoteForm(true);
  };
  
  // Save segment note
  const saveSegmentNote = async () => {
    try {
      // Create the segment annotation
      const annotationId = await annotationService.createVideoSegmentAnnotation(
        userId,
        videoId,
        segmentStart,
        currentTime,
        noteText,
        true // Private by default
      );
      
      // Track the annotation creation
      trackingService.trackEvent('create_annotation', {
        annotation_type: 'video_segment',
        video_id: videoId,
        start_time: segmentStart,
        end_time: currentTime,
        duration: currentTime - segmentStart,
        note_length: noteText.length
      });
      
      // Clear form
      setNoteText('');
      setShowAddNoteForm(false);
      
      // Refresh annotations
      const data = await annotationService.getAnnotationsForResource('video', videoId, userId);
      setAnnotations(data);
    } catch (error) {
      console.error('Error creating segment annotation:', error);
    }
  };
  
  // Render video timeline with annotations
  const renderTimeline = () => {
    // Implementation to render annotations on video timeline
    // This would create interactive markers for timestamps
    // and highlighted regions for segments
  };
  
  useEffect(() => {
    if (annotations.length > 0) {
      renderTimeline();
    }
  }, [annotations, currentTime]);
  
  return (
    <div className="video-annotator">
      <div className="video-timeline">
        {/* Timeline visualization would go here */}
      </div>
      
      <div className="annotation-controls">
        <button onClick={createTimestampAnnotation}>Add Note at Current Time</button>
        
        {!isRecordingSegment ? (
          <button onClick={startSegmentRecording}>Start Segment</button>
        ) : (
          <button onClick={endSegmentRecording}>End Segment</button>
        )}
      </div>
      
      {showAddNoteForm && (
        <div className="add-note-form">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your note here..."
          />
          <div className="form-actions">
            <button onClick={isRecordingSegment ? saveSegmentNote : saveTimestampNote}>
              Save
            </button>
            <button onClick={() => setShowAddNoteForm(false)}>Cancel</button>
          </div>
        </div>
      )}
      
      <div className="annotations-list">
        {annotations.map(annotation => (
          <div key={annotation.annotation_id} className="annotation-item">
            {annotation.annotation_type === 'timestamp' && (
              <div className="timestamp-annotation">
                <div className="timestamp">
                  {formatTime(annotation.video_annotations.timestamp_seconds)}
                </div>
                <div className="content">{annotation.video_annotations.text_content}</div>
                <button onClick={() => jumpToTime(annotation.video_annotations.timestamp_seconds)}>
                  Jump to
                </button>
              </div>
            )}
            
            {annotation.annotation_type === 'segment' && (
              <div className="segment-annotation">
                <div className="segment-time">
                  {formatTime(annotation.video_annotations.start_time)} - 
                  {formatTime(annotation.video_annotations.end_time)}
                </div>
                <div className="content">{annotation.video_annotations.text_content}</div>
                <button onClick={() => playSegment(
                  annotation.video_annotations.start_time,
                  annotation.video_annotations.end_time
                )}>
                  Play Segment
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  
  // Helper function to format time
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // Helper function to jump to specific time
  function jumpToTime(seconds: number): void {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  }
  
  // Helper function to play a segment
  function playSegment(start: number, end: number): void {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      videoRef.current.play();
      
      const checkTime = () => {
        if (videoRef.current && videoRef.current.currentTime >= end) {
          videoRef.current.pause();
          videoRef.current.removeEventListener('timeupdate', checkTime);
        }
      };
      
      videoRef.current.addEventListener('timeupdate', checkTime);
    }
  }
};

export default VideoAnnotator;
```

### AI-Enhanced Features

The annotation system can be enhanced with AI capabilities to provide additional value:

1. **Automatic Concept Tagging**:

```typescript
// src/services/ai-annotation-service.ts
import { createClient } from '@supabase/supabase-js';
import { claudeService } from './claude-service';
import { annotationService } from './annotation-service';

class AIAnnotationService {
  private static instance: AIAnnotationService;
  private supabase: any;
  
  private constructor() {
    this.supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL || '',
      process.env.REACT_APP_SUPABASE_ANON_KEY || ''
    );
  }
  
  public static getInstance(): AIAnnotationService {
    if (!AIAnnotationService.instance) {
      AIAnnotationService.instance = new AIAnnotationService();
    }
    return AIAnnotationService.instance;
  }
  
  public async generateConceptTags(
    annotationId: string,
    text: string
  ): Promise<string[]> {
    try {
      // Get relevant domain for tagging based on document type
      const { data: annotation } = await this.supabase
        .from('annotations')
        .select(`
          *,
          resource_id
        `)
        .eq('annotation_id', annotationId)
        .single();
      
      const { data: document } = await this.supabase
        .from('documents')
        .select('document_type')
        .eq('id', annotation.resource_id)
        .single();
      
      // Create prompt based on document type
      const prompt = `
        Extract the key concepts from the following text. 
        The text is from a document of type: ${document.document_type}.
        Focus on ${this.getConceptFocus(document.document_type)}.
        
        Text: "${text}"
        
        Return ONLY a JSON array of concept names, with no additional text.
        Example: ["concept1", "concept2", "concept3"]
      `;
      
      // Get concepts from Claude
      const conceptsJson = await claudeService.getJsonResponse(prompt);
      
      // Add concepts as tags
      for (const concept of conceptsJson) {
        await annotationService.addConceptTag(
          annotationId,
          concept,
          true, // AI generated
          0.9  // High confidence
        );
      }
      
      return conceptsJson;
    } catch (error) {
      console.error('Error generating concept tags:', error);
      return [];
    }
  }
  
  private getConceptFocus(documentType: string): string {
    // Return different focus areas based on document type
    switch (documentType) {
      case 'research_paper':
        return 'scientific concepts, methodologies, findings';
      case 'therapeutic_protocol':
        return 'therapeutic approaches, methods, conditions treated';
      case 'case_study':
        return 'conditions, treatments, outcomes, symptoms';
      default:
        return 'key topics and concepts';
    }
  }
  
  public async suggestRelatedAnnotations(
    annotationId: string
  ): Promise<any[]> {
    try {
      // Get the annotation and its text
      const { data: annotation } = await this.supabase
        .from('annotations')
        .select(`
          *,
          text_annotations(*),
          video_annotations(*),
          concept_tags(*)
        `)
        .eq('annotation_id', annotationId)
        .single();
      
      // Get text content based on annotation type
      let text = '';
      if (annotation.annotation_type === 'highlight') {
        text = annotation.text_annotations.selection_text || '';
      } else {
        text = annotation.video_annotations.text_content || '';
      }
      
      // Get concepts for this annotation
      const conceptNames = annotation.concept_tags.map(tag => tag.concept_name);
      
      // If we have concepts, find annotations with similar concepts
      if (conceptNames.length > 0) {
        const { data: relatedAnnotations } = await this.supabase
          .from('concept_tags')
          .select(`
            annotation_id,
            concept_name,
            annotations(
              *,
              text_annotations(*),
              video_annotations(*)
            )
          `)
          .in('concept_name', conceptNames)
          .neq('annotation_id', annotationId);
        
        return relatedAnnotations;
      }
      
      return [];
    } catch (error) {
      console.error('Error suggesting related annotations:', error);
      return [];
    }
  }
  
  public async generateQuizQuestion(
    annotationId: string
  ): Promise<any> {
    try {
      // Get the annotation and its text
      const { data: annotation } = await this.supabase
        .from('annotations')
        .select(`
          *,
          text_annotations(*),
          video_annotations(*),
          resource_id
        `)
        .eq('annotation_id', annotationId)
        .single();
      
      // Get text content based on annotation type
      let text = '';
      let contextType = '';
      
      if (annotation.annotation_type === 'highlight') {
        text = annotation.text_annotations.selection_text || '';
        contextType = 'document highlight';
      } else if (annotation.annotation_type === 'timestamp') {
        text = annotation.video_annotations.text_content || '';
        contextType = 'video timestamp note';
      } else {
        text = annotation.video_annotations.text_content || '';
        contextType = 'video segment note';
      }
      
      // Get additional context if needed
      let additionalContext = '';
      if (annotation.resource_type === 'document') {
        const { data: document } = await this.supabase
          .from('documents')
          .select('title, document_type')
          .eq('id', annotation.resource_id)
          .single();
        
        additionalContext = `This is from a ${document.document_type} titled "${document.title}".`;
      }
      
      // Create prompt for Claude
      const prompt = `
        Generate a quiz question based on the following ${contextType}:
        
        "${text}"
        
        ${additionalContext}
        
        Return a JSON object with the following structure:
        {
          "question": "The question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": "The text of the correct option",
          "explanation": "Explanation of why this is the correct answer"
        }
        
        The question should test understanding of important concepts in the text.
        Return ONLY the JSON object, with no additional text.
      `;
      
      // Get quiz question from Claude
      const quizQuestion = await claudeService.getJsonResponse(prompt);
      return quizQuestion;
    } catch (error) {
      console.