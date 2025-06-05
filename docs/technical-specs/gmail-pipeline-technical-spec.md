# Gmail Pipeline Technical Specification

## Overview
This document outlines the technical specification for implementing a Gmail CLI pipeline in the dhg-mono monorepo, based on the existing Python implementation found in `dhg-knowledge-tool-2`.

## Current Implementation Analysis

### Existing Architecture (dhg-knowledge-tool-2)
The current implementation uses:
- **Language**: Python
- **Database**: SQLite (`DynamicHealing.db`)
- **Email Access**: IMAP with Gmail API
- **AI Processing**: Claude API for content analysis
- **Architecture**: Modular Python scripts with database CRUD operations

### Key Components
1. **Email Extraction** (`emails.py`)
   - IMAP connection to Gmail
   - Date range filtering
   - Important email address filtering
   - Attachment and URL extraction

2. **Database Tables**
   - `emails` - Core email metadata
   - `email_contents` - AI-processed content
   - `email_concepts` - Extracted concepts
   - `important_email_addresses` - Email importance tracking
   - `attachments` - Email attachments
   - `all_email_urls` - Extracted URLs
   - `urls` - Aggregated URL information

3. **AI Processing**
   - Claude API integration for content analysis
   - Extraction of participants, summaries, quotes
   - Scientific content classification
   - Meeting detection

## Proposed Architecture for dhg-mono

### Technology Stack
- **Primary Language**: TypeScript (for consistency with monorepo)
- **Python Services**: Retained for Gmail API interaction
- **Database**: Supabase (PostgreSQL)
- **CLI Framework**: Commander.js
- **Shared Services**: Leverage existing monorepo patterns

### Migration Strategy

#### Phase 1: Database Schema Migration
1. Convert SQLite schema to PostgreSQL/Supabase
2. Follow naming conventions:
   - `email_messages` (already exists in current schema)
   - `email_contents` → `email_processed_contents`
   - `email_concepts` → `email_extracted_concepts`
   - `important_email_addresses` → `email_important_addresses`
   - `attachments` → `email_attachments`
   - `all_email_urls` → `email_extracted_urls`

#### Phase 2: Python Service Wrapper
Create a Python service in `packages/python-gmail-service/`:
```
packages/python-gmail-service/
├── src/
│   ├── gmail_client.py
│   ├── email_extractor.py
│   ├── url_extractor.py
│   └── requirements.txt
├── README.md
└── setup.py
```

#### Phase 3: TypeScript CLI Pipeline
Create in `scripts/cli-pipeline/gmail/`:
```
scripts/cli-pipeline/gmail/
├── gmail-cli.sh
├── package.json
├── sync-emails.ts
├── process-emails.ts
├── analyze-emails.ts
├── manage-important-addresses.ts
└── README.md
```

#### Phase 4: Shared Services Integration
Create/enhance shared services:
- `packages/shared/services/email-service/`
- `packages/shared/services/gmail-adapter/`

### Implementation Plan

#### 1. Database Migration (Week 1)
```sql
-- Create email schema tables
CREATE TABLE email_important_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_address TEXT NOT NULL UNIQUE,
    importance_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE email_extracted_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    email_content_id UUID REFERENCES email_processed_contents(id),
    concept TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    example TEXT,
    confidence_score FLOAT,
    subject_classifications JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    filename TEXT NOT NULL,
    size_bytes INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_extracted_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_message_id UUID REFERENCES email_messages(id),
    url TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Python Gmail Service (Week 2)
Key features:
- OAuth 2.0 authentication (replacing app passwords)
- Service account support
- Batch email fetching
- Error handling and retry logic
- JSON output for TypeScript consumption

#### 3. TypeScript CLI Implementation (Week 3)
Commands structure:
```bash
# Main CLI entry point
./scripts/cli-pipeline/gmail/gmail-cli.sh [command] [options]

# Commands:
# - sync-emails: Fetch new emails from Gmail
# - process-emails: Run AI analysis on unprocessed emails
# - manage-addresses: Add/update important email addresses
# - analyze-concepts: Extract concepts from processed emails
# - export-data: Export email data for analysis
```

#### 4. Shared Services (Week 4)
- Email service with standard interfaces
- Gmail adapter using Python subprocess
- Supabase integration for all database operations
- Claude service integration for AI processing

### Key Features to Implement

1. **Authentication**
   - Google OAuth 2.0 flow
   - Service account support
   - Secure credential storage

2. **Email Synchronization**
   - Incremental sync (only new emails)
   - Date range filtering
   - Sender filtering by importance
   - Duplicate detection

3. **Content Processing**
   - AI-powered content analysis
   - Participant extraction
   - Quote extraction
   - Scientific content detection
   - Meeting detection

4. **URL Management**
   - URL extraction and validation
   - Domain categorization
   - Duplicate URL handling

5. **Monitoring & Reporting**
   - Sync statistics
   - Processing status tracking
   - Error logging and alerting

### CLI Command Examples

```bash
# Set up important email addresses
./gmail-cli.sh manage-addresses add "researcher@example.com" --importance=2

# Sync emails from the last 7 days
./gmail-cli.sh sync-emails --days=7 --importance=2

# Process unprocessed emails with AI
./gmail-cli.sh process-emails --limit=50

# Analyze concepts in processed emails
./gmail-cli.sh analyze-concepts --from="2024-01-01"

# Export email data
./gmail-cli.sh export-data --format=csv --output=./exports/
```

### Environment Configuration

Required environment variables:
```env
# Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Or service account
GOOGLE_SERVICE_ACCOUNT_PATH=./.service-account.json

# Gmail settings
GMAIL_ACCOUNT=your_email@gmail.com
GMAIL_MAX_RESULTS=100

# Processing settings
GMAIL_IMPORTANCE_THRESHOLD=1
GMAIL_AI_PROCESSING_ENABLED=true
```

### Security Considerations

1. **Credential Management**
   - Use environment variables for sensitive data
   - Support service account authentication
   - Implement OAuth 2.0 flow for user authentication

2. **Data Privacy**
   - Email content encryption at rest
   - PII handling compliance
   - Audit logging for all operations

3. **Access Control**
   - Row-level security for email data
   - User-specific email access
   - Admin-only bulk operations

### Testing Strategy

1. **Unit Tests**
   - Python service tests
   - TypeScript command tests
   - Database migration tests

2. **Integration Tests**
   - End-to-end email sync
   - AI processing pipeline
   - Database integrity

3. **Performance Tests**
   - Bulk email processing
   - Database query optimization
   - Concurrent operation handling

### Migration Checklist

- [ ] Create database migration files
- [ ] Set up Python virtual environment
- [ ] Implement Gmail OAuth flow
- [ ] Create Python email extraction service
- [ ] Build TypeScript CLI commands
- [ ] Integrate with shared services
- [ ] Add comprehensive error handling
- [ ] Write documentation
- [ ] Create unit tests
- [ ] Perform security audit
- [ ] Deploy to staging environment
- [ ] User acceptance testing
- [ ] Production deployment

### Future Enhancements

1. **Advanced Features**
   - Real-time email monitoring
   - Webhook integration
   - Advanced filtering rules
   - Email threading analysis

2. **AI Improvements**
   - Custom prompt templates
   - Multi-model support
   - Confidence scoring
   - Feedback loop for accuracy

3. **Integration Options**
   - Slack notifications
   - Calendar integration
   - Task management sync
   - Research tool integration

## Conclusion

This specification provides a comprehensive plan for implementing a Gmail pipeline in the dhg-mono monorepo. The approach leverages existing code while modernizing the architecture to fit within the current monorepo structure and best practices.