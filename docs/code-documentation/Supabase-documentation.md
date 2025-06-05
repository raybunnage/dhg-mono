# Supabase Page Documentation

## Overview
The Supabase page provides a comprehensive schema explorer and database inspection tool. It allows users to view database schema information, explore tables, inspect table structures, and view data samples from the connected Supabase database.

## Key Features

### Schema Exploration
- Retrieves and displays complete database schema
- Lists all accessible tables and views with row counts
- Shows foreign key relationships
- Provides table metadata including columns and data types

### Table Data Inspection
- Loads sample data from tables
- Presents data in formatted tables
- Supports direct JSON viewing of data
- Allows copying schema structures for development use

### Filtering and Navigation
- Filter tables by category (Documents, Experts, Prompts, etc.)
- Toggle between showing all or non-empty tables
- Search for specific tables by name
- Quick access to commonly used tables

### Caching System
- Implements intelligent caching for improved performance
- Caches schema data, foreign keys, table metadata, and table data
- Provides clear indicators when using cached vs. live data
- Includes controls to refresh or clear cache

## Technical Components

### Authentication
- Automatically handles authentication with Supabase
- Uses test credentials from environment variables when needed
- Verifies database connection before operations
- Handles authentication errors gracefully

### Database Queries
- Uses Supabase JavaScript client for all database operations
- Implements error handling for permission issues
- Limits data retrieval to prevent performance issues
- Handles RLS (Row Level Security) restrictions appropriately

### Cache System
- Uses the `useSupabaseTabCache` custom hook
- Maintains separate caches for different data types
- Implements cache invalidation controls
- Provides clear UI indicators for cached state

### UI Components
- Table filtering pills for quick category filtering
- Table/JSON toggle views for data inspection
- Interactive sorting controls for table listings
- Collapsible sections for detailed information

## Implementation Notes

### Error Handling
- Graceful handling of permissions errors
- Clear error messages for table not found scenarios
- Fallbacks for empty tables or missing data
- Toast notifications for important operations

### Performance Optimizations
- Uses pagination and data limiting for large tables
- Implements throttling for repeated database calls
- Uses cached data when appropriate
- Provides refresh controls for obtaining current data

### Security Considerations
- Respects RLS policies configured in Supabase
- Does not expose credentials in the UI
- Handles authentication tokens securely
- Shows appropriate "Permission denied" messages

## User Interface
- Clean, organized layout with tabs and cards
- Interactive table listings with filtering controls
- Split views showing both schema and data information
- Copy functionality for schema definitions

## Database Tables
The page primarily interacts with and displays information about the following tables:
- `sources_google`: Google Drive source files
- `sync_history`: File synchronization history
- `experts`: Expert profiles information
- `expert_documents`: Processed documents for experts
- `document_types`: Document classification categories
- `prompts`: AI prompt templates
- Various other tables in the database schema

## Usage Examples
1. **Discovering table structure**: Find a table and view its columns, types, and sample values
2. **Data inspection**: Quickly view sample rows from important tables
3. **Schema export**: Export table structures for development reference
4. **Database relationships**: Understand foreign key relationships between tables