# DHG-Hub Application Overview

## Introduction

DHG-Hub is a single-page React application designed for displaying, filtering, and interacting with presentation videos and their associated content. The application serves as a central access point for viewing expert presentations, related documents, and AI-processed analysis.

## What is a Single-Page Application (SPA)?

DHG-Hub is built as a Single-Page Application, which means:

- It loads a single HTML page and dynamically updates content as users interact with the app
- Navigation between views happens without full page reloads
- All necessary code (HTML, JavaScript, and CSS) is retrieved with a single page load
- Additional resources and data are loaded dynamically as needed
- This architecture provides a smoother, more responsive user experience

## Application Architecture

The application uses:
- **React**: Frontend library for building user interfaces
- **Vite**: Build tool for fast development and optimized production builds
- **React Router**: For navigation between different views
- **Supabase**: For database access and authentication
- **TypeScript**: For type-safe code

## Key Components and Database Integration

### 1. Navigation Bar

**Component**: `MainNavbar`

**Purpose**: Provides navigation between different sections of the application.

**Database Tables**: None

**Implementation Details**:
- Uses React Router's `Link` component for navigation
- Highlights the current active page
- Simple navigation between the main app and testing page

### 2. Filter Profile Management

**Component**: Filter profile selection UI

**Database Tables**:
- `user_filter_profiles`: Stores user-defined filter configurations
- `user_filter_profile_drives`: Links filter profiles to specific Google Drive folders

**Key Queries**:
```sql
-- Fetch user filter profiles
SELECT * FROM user_filter_profiles ORDER BY name

-- Set active profile (two-step process)
UPDATE user_filter_profiles SET is_active = false
UPDATE user_filter_profiles SET is_active = true WHERE id = $profileId

-- Get drive IDs associated with a profile
SELECT source_id FROM user_filter_profile_drives WHERE profile_id = $profileId
```

**Implementation Details**:
- Allows users to select predefined filter profiles
- Controls which content is displayed throughout the application
- Persists filter selections between sessions

### 3. Presentation List

**Component**: Presentation listing with filtering and search

**Database Tables**:
- `presentations`: Central table storing presentation metadata
- `sources_google`: Contains file information from Google Drive
- `experts`: Information about presentation experts
- `sources_google_experts`: Junction table linking sources to experts
- `subject_classifications`: Subject categories/topics
- `table_classifications`: Maps entities to subject classifications

**Key Queries**:
```sql
-- Complex nested query to fetch presentations with related data
SELECT 
  p.id, 
  p.video_source_id,
  p.expert_document_id,
  p.high_level_folder_source_id,
  p.web_view_link,
  p.created_at,
  ed.id, ed.title, ed.processed_content,
  vs.id, vs.name, vs.mime_type, vs.web_view_link,
  vs.document_type_id, vs.created_at, vs.modified_at, vs.size, vs.metadata,
  hlf.id, hlf.name, hlf.drive_id
FROM presentations p
LEFT JOIN expert_documents ed ON p.expert_document_id = ed.id
LEFT JOIN sources_google vs ON p.video_source_id = vs.id
LEFT JOIN sources_google hlf ON p.high_level_folder_source_id = hlf.id
WHERE p.video_source_id IS NOT NULL
```

**Implementation Details**:
- Displays a filterable, searchable list of presentations
- Implements search across title, expert name, and content
- Supports filtering by subject classification
- Uses client-side filtering for quick response
- Pagination for handling large result sets

### 4. Video Player & Presentation Details

**Component**: Video player with associated metadata

**Database Tables**:
- `sources_google`: Contains video file metadata and links
- `expert_documents`: Contains AI-processed content for presentations
- `experts`: Information about presenting experts

**Key Queries**:
```sql
-- Get video source details for a presentation
SELECT id, name, web_view_link, mime_type 
FROM sources_google 
WHERE id = $videoSourceId

-- Get expert document content
SELECT id, title, processed_content 
FROM expert_documents 
WHERE id = $expertDocumentId
```

**Implementation Details**:
- Embeds video player using Google Drive viewer links
- Displays presentation title, date, and expert information
- Shows AI-processed content from expert documents
- Responsive design adapts to different screen sizes

### 5. Presentation Assets

**Component**: Asset listing and viewer

**Database Tables**:
- `presentation_assets`: Links assets to presentations
- `sources_google`: Contains file metadata for assets
- `expert_documents`: Contains AI-processed content for documents

**Key Queries**:
```sql
-- Get assets for a presentation
SELECT 
  pa.id, pa.asset_type, pa.asset_role, pa.source_id,
  sg.id, sg.name, sg.mime_type, sg.web_view_link,
  ed.id, ed.title, ed.processed_content
FROM presentation_assets pa
JOIN sources_google sg ON pa.source_id = sg.id
LEFT JOIN expert_documents ed ON pa.expert_document_id = ed.id
WHERE pa.presentation_id = $presentationId
```

**Implementation Details**:
- Lists associated assets for the selected presentation
- Groups assets by type (document, image, etc.)
- Provides preview functionality for documents
- Displays AI-processed summaries when available

### 6. JSON Formatter

**Component**: `JsonFormatter`

**Database Tables**: N/A (utility component)

**Implementation Details**:
- Formats complex JSON data into user-friendly displays
- Handles different data types: summaries, expert profiles, content
- Includes collapsible sections for better organization
- Transforms snake_case keys to Title Case for readability
- Filters out internal metadata fields

### 7. Collapsible Component

**Component**: `Collapsible`

**Database Tables**: N/A (utility component)

**Implementation Details**:
- Provides expandable/collapsible sections throughout the UI
- Helps manage visual complexity
- Used for organizing complex hierarchical information

### 8. Supabase Integration Components

**Component**: SupabaseClientAdapter and FilterService

**Database Tables**: All tables (provides database access layer)

**Implementation Details**:
- Implements singleton pattern for database connection
- Handles environment variables for Supabase credentials
- Provides connection testing and error handling
- Manages caching for improved performance
- Implements filter application logic

## Data Flow

1. **Initial Load**:
   - Application authenticates with Supabase
   - Loads filter profiles
   - Identifies active profile
   - Fetches presentations based on filter criteria

2. **Filter Application**:
   - User selects filter profile
   - System updates active profile in database
   - Application reloads presentations with new filter criteria
   - Client-side filtering applied for search and subject filters

3. **Presentation Selection**:
   - User selects a presentation
   - Video player loads the presentation
   - Metadata and expert information displayed
   - Associated assets loaded
   - AI-processed content rendered

4. **Asset Interaction**:
   - User selects an asset
   - Asset preview displayed
   - AI-processed content for asset shown if available

## Technical Implementation Notes

### State Management
- Uses React hooks (useState, useEffect) for local component state
- Props for passing data between components
- No global state management library (Redux/Context)

### Performance Optimizations
- Caching of filter drive IDs
- Client-side filtering for responsive UI
- Collapsible sections to manage visual complexity
- Efficient query patterns to minimize database requests

### Error Handling
- Comprehensive error handling for database operations
- Fallback UI for missing or invalid data
- Connection testing for troubleshooting

## Conclusion

DHG-Hub is a sophisticated single-page application that provides a centralized interface for accessing and interacting with presentation content. The application demonstrates advanced React patterns, complex database querying through Supabase, and thoughtful UI design to manage the complexity of presenting hierarchical data relationships in an intuitive interface.