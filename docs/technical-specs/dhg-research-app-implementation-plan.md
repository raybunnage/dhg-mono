# DHG Research App Implementation Plan

## Overview
The dhg-research app will be a comprehensive research dashboard that integrates email data, extracted content, and document viewing capabilities. It will feature a darker blue theme and provide tools for managing and analyzing research-related communications.

## Email-Related Tables Analysis

### Tables to Migrate from dhg-knowledge-tool-2

1. **emails** (Core email storage)
   - Already partially exists as `email_messages` in current schema
   - Need to merge/migrate additional fields

2. **email_contents** (AI-processed content)
   - Contains participants, summaries, quotes, science flags
   - Needs UUID conversion

3. **email_concepts** (Extracted concepts from emails)
   - Links to both emails and email_contents
   - Contains categorized knowledge extracted from emails

4. **all_email_urls** (Raw URL extraction)
   - Simple junction table linking emails to URLs
   - Used for tracking all URLs found in emails

5. **urls** (Aggregated URL information)
   - **This is the key content extraction table**
   - Contains processed information from web pages:
     - Article metadata (title, authors, summary, keywords)
     - Publication dates (year, month, day)
     - Processing flags
     - Email associations

6. **rolled_up_emails** (Email aggregation)
   - Groups similar emails by subject
   - Tracks patterns and statistics
   - Useful for research topic identification

7. **attachments** (Email attachments)
   - Tracks files attached to emails
   - Links to PDFs and other documents

8. **important_email_addresses** (Email filtering)
   - Controls which emails to process
   - Importance levels for prioritization

## Database Migration Plan

### Phase 1: Schema Design (Supabase)

```sql
-- 1. Email Important Addresses (already planned)
CREATE TABLE email_important_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT NOT NULL UNIQUE,
    importance_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Email Processed Contents (enhanced)
CREATE TABLE email_processed_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    participants_count INTEGER,
    participants JSONB,
    summary TEXT,
    is_science_discussion BOOLEAN DEFAULT FALSE,
    is_science_material BOOLEAN DEFAULT FALSE, 
    is_meeting_focused BOOLEAN DEFAULT FALSE,
    notable_quotes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Email Extracted Concepts
CREATE TABLE email_extracted_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    email_content_id UUID REFERENCES email_processed_contents(id),
    concept TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    example TEXT,
    quote TEXT,
    quote_author TEXT,
    confidence_score FLOAT,
    subject_classifications JSONB,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Email Extracted URLs (simple junction)
CREATE TABLE email_extracted_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Research URLs (aggregated and processed)
CREATE TABLE research_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    domain TEXT,
    email_associations JSONB, -- {email_ids, senders, subjects}
    email_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    -- Content metadata
    title TEXT,
    authors TEXT[],
    summary TEXT,
    keywords TEXT[],
    published_date DATE,
    -- Processing flags
    is_processed BOOLEAN DEFAULT FALSE,
    is_accessible BOOLEAN,
    process_ai_concepts BOOLEAN DEFAULT FALSE,
    -- Type and source
    url_type TEXT, -- article, video, pdf, etc.
    content_source TEXT, -- journal, blog, news, etc.
    -- Metadata
    extraction_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Email Thread Aggregations (rolled up)
CREATE TABLE email_thread_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_pattern TEXT NOT NULL,
    email_count INTEGER DEFAULT 1,
    first_email_date TIMESTAMP,
    last_email_date TIMESTAMP,
    senders TEXT[],
    total_attachments INTEGER DEFAULT 0,
    total_urls INTEGER DEFAULT 0,
    email_ids UUID[],
    is_likely_research BOOLEAN DEFAULT FALSE,
    thread_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Email Attachments (enhanced)
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    filename TEXT NOT NULL,
    file_extension TEXT,
    size_bytes INTEGER,
    mime_type TEXT,
    is_processed BOOLEAN DEFAULT FALSE,
    google_drive_id TEXT, -- if uploaded to Drive
    processing_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_research_urls_domain ON research_urls(domain);
CREATE INDEX idx_research_urls_processed ON research_urls(is_processed);
CREATE INDEX idx_email_concepts_category ON email_extracted_concepts(category);
CREATE INDEX idx_email_threads_subject ON email_thread_aggregations(subject_pattern);
```

### Phase 2: Data Migration Strategy

1. **UUID Conversion**
   - Map integer IDs to UUIDs during migration
   - Maintain mapping table for reference integrity

2. **Data Cleaning**
   - Normalize email addresses
   - Deduplicate URLs
   - Clean up encoding issues

3. **Data Enhancement**
   - Extract domains from URLs
   - Parse dates properly
   - Convert JSON strings to JSONB

## App Architecture

### Technology Stack
- **Framework**: React with TypeScript
- **UI Library**: Tailwind CSS with custom dark blue theme
- **State Management**: Zustand or Context API
- **Data Fetching**: Tanstack Query (React Query)
- **Components**: Shared components from packages/shared

### App Structure
```
apps/dhg-research/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   └── Navigation.tsx
│   │   ├── gmail/
│   │   │   ├── EmailList.tsx
│   │   │   ├── EmailDetail.tsx
│   │   │   ├── EmailSync.tsx
│   │   │   ├── ImportantAddresses.tsx
│   │   │   └── EmailAnalytics.tsx
│   │   └── research/
│   │       ├── URLExplorer.tsx
│   │       ├── ConceptBrowser.tsx
│   │       └── ResearchDashboard.tsx
│   ├── pages/
│   │   ├── GmailPage.tsx
│   │   └── ViewerPage.tsx
│   ├── services/
│   │   ├── emailService.ts
│   │   ├── urlService.ts
│   │   └── conceptService.ts
│   ├── hooks/
│   │   ├── useEmails.ts
│   │   ├── useURLs.ts
│   │   └── useConcepts.ts
│   └── theme/
│       └── darkBlueTheme.ts
├── public/
├── index.html
├── package.json
└── vite.config.ts
```

## UI Components

### 1. Gmail Management Page
Features:
- **Email Sync Control**
  - Date range selection
  - Importance filter
  - Sync status and progress
  
- **Email List View**
  - Sortable/filterable table
  - Quick actions (process, archive, star)
  - Search functionality
  
- **Email Detail Panel**
  - Full content view
  - Extracted concepts
  - Related URLs
  - Processing status
  
- **Important Addresses Manager**
  - Add/remove addresses
  - Set importance levels
  - View statistics

- **Analytics Dashboard**
  - Email volume over time
  - Top senders
  - Concept frequency
  - URL domains

### 2. Research Viewer Page
- Integrate existing viewer from shared components
- Add research-specific features:
  - Concept highlighting
  - Related emails sidebar
  - URL preview cards

## Theme Configuration

### Dark Blue Theme
```typescript
// theme/darkBlueTheme.ts
export const darkBlueTheme = {
  colors: {
    primary: {
      50: '#e6f1ff',
      100: '#b3d1ff',
      200: '#80b2ff',
      300: '#4d93ff',
      400: '#1a74ff',
      500: '#0055e6',  // Main brand color
      600: '#0044b3',
      700: '#003380',
      800: '#00224d',
      900: '#00111a',  // Darkest
    },
    background: {
      main: '#00111a',
      paper: '#001933',
      elevated: '#002244',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3d1ff',
      muted: '#6699cc',
    }
  }
};
```

## Integration Points

### 1. Gmail CLI Pipeline
- Use the Gmail CLI commands from the research app
- Real-time sync status updates
- WebSocket or polling for progress

### 2. Shared Services
- Extend SupabaseClientService
- Create EmailService in shared/services
- Use existing DocumentViewer component

### 3. AI Processing
- Queue emails for processing
- Display processing status
- Show extracted concepts in real-time

## Implementation Timeline

### Week 1: Database Setup
- [ ] Create migration scripts
- [ ] Set up new tables in Supabase
- [ ] Create data migration tools
- [ ] Test data integrity

### Week 2: App Foundation
- [ ] Create dhg-research app structure
- [ ] Set up dark blue theme
- [ ] Integrate authentication
- [ ] Create basic routing

### Week 3: Gmail Features
- [ ] Build email sync UI
- [ ] Create email list/detail views
- [ ] Implement address management
- [ ] Add email analytics

### Week 4: Research Features
- [ ] Integrate document viewer
- [ ] Build URL explorer
- [ ] Create concept browser
- [ ] Add search functionality

### Week 5: Integration & Polish
- [ ] Connect to Gmail CLI pipeline
- [ ] Add real-time updates
- [ ] Implement error handling
- [ ] Performance optimization

## Security Considerations

1. **Data Access**
   - Row-level security for emails
   - User-specific data isolation
   - Audit logging

2. **Content Security**
   - Sanitize email content
   - Validate URLs before fetching
   - Secure iframe for previews

3. **API Security**
   - Rate limiting
   - Authentication required
   - CORS configuration

## Performance Optimization

1. **Database**
   - Proper indexing
   - Materialized views for analytics
   - Pagination for large datasets

2. **Frontend**
   - Virtual scrolling for lists
   - Lazy loading for details
   - Debounced search

3. **Caching**
   - React Query caching
   - Service worker for offline
   - CDN for static assets

## Future Enhancements

1. **Advanced Analytics**
   - Topic modeling
   - Sentiment analysis
   - Network graphs

2. **Collaboration**
   - Share research findings
   - Comment on emails
   - Team workspaces

3. **Integrations**
   - Export to research tools
   - Calendar integration
   - Task management

## Conclusion

The dhg-research app will provide a comprehensive platform for managing and analyzing research-related emails and content. By migrating the existing email tables and building a modern UI, researchers will have powerful tools for extracting insights from their communications.