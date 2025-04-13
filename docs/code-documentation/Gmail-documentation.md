# Gmail Page Documentation

## Overview
The Gmail page is a comprehensive dashboard for analyzing and processing email data from Gmail. It provides tools for importing emails, extracting content, analyzing email content with AI, and managing extracted URLs.

## Key Features

### Email Management
- Search Gmail using custom queries and date ranges
- Import new emails into the database
- View email details including sender, subject, date, and attachment count
- Track processing status of each email

### Content Processing
- Extract and analyze email content using AI
- Identify participants in email threads
- Generate summaries of email content
- Classify emails based on scientific relevance and meeting focus
- Extract notable quotes from email content

### URL Management
- Extract URLs from email content
- Display and organize extracted links
- Provide direct access to external resources
- Track URL sources by email ID

### Dashboard Analytics
- Display key metrics and statistics
- Track total email count, processed emails, and pending analysis
- Monitor extraction progress
- View recent activities in a timeline format

## Technical Components

### Status Cards
- Visual indicators for key metrics
- Real-time stat tracking with trend indicators
- Color-coded status information

### Search System
- Form-based Gmail search interface
- Query builder with date range selection
- Support for Gmail search syntax

### Processing Controls
- Batch operations for email processing
- Multi-stage workflow management
- Progress tracking with visual indicators
- Process separation (import, content extraction, URL extraction)

### Data Tables
- Tabular display of emails, content, and URLs
- Filtering and sorting capabilities
- Action buttons for item-specific operations
- Status indicators for processing state

## UI Components
The page is built using several reusable components:

### Display Components
- `StatusCard`: Shows key metrics with trends
- `ActivityTimeline`: Displays recent system activities
- `EmailTable`: Shows email list with metadata
- `EmailContentTable`: Displays processed content data
- `UrlTable`: Lists extracted URLs with source information

### Interactive Components
- `SearchForm`: Interface for querying Gmail
- `ProcessControl`: Manages batch processing operations
- `ActionButton`: Button with icon for quick actions
- `Tabs`: Navigation between different data views

## Data Models
The page works with several data types:

- `Email`: Email metadata including sender, subject, and processing status
- `EmailContent`: Processed content with AI analysis results
- `EmailUrl`: URLs extracted from emails
- `Activity`: System actions for tracking in the timeline

## Implementation Notes

### Mock Data
The current implementation uses mock data for demonstration purposes:
- Simulated email records
- Mock content analysis
- Sample URL extraction

### Future Integration
The page is designed to connect with:
- Gmail API for direct email access
- AI processing services for content analysis
- Backend database for persistent storage

## Backend Integration
The page is prepared to interact with:
- Supabase database for data storage
- Python backend services for Gmail access
- AI processing pipeline for content analysis

## Workflow
1. User searches Gmail using the search form
2. Emails are imported from Gmail into the database
3. Email content is processed with AI analysis
4. URLs are extracted from email content
5. Results are displayed in the appropriate tables
6. Statistics are updated to reflect the current state