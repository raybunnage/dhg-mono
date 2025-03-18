# Expert System Audit

This document provides a systematic overview of expert-related functionality in the codebase, identifying existing components, their relationships, and potential orphaned functionality.

## Existing Expert-related Files and Components

### Primary Pages and Routes

- `src/pages/Experts.tsx` - Main experts listing page
  - Displays a grid of expert cards
  - Connects to Supabase 'experts' table
  - Links to individual expert pages and profile extractor

- `src/pages/ExpertDetail.tsx` - Individual expert view
  - Shows detailed information for a single expert
  - Implements tabs for overview, presentations, and publications
  - UI skeleton without connected data source

- `src/pages/ExpertProfiles.tsx` - For viewing expert documents
  - Displays a file tree of expert-related documents
  - Connects to 'sources_google' and 'expert_documents' tables

### Components

- `src/components/ExpertCard.tsx` - Displays expert information
  - Card component for showing expert profile summary
  - Includes expertise tags, stats, and latest presentation

- `src/components/ExpertProfileExtractor.tsx` - Large component for extracting expert data
  - Complex UI for processing documents and extracting expert profiles
  - Includes batch processing, filtering, and progress monitoring
  - Makes AI calls to process content

- `src/components/experts/ExpertForm.tsx` - Form for creating/editing experts
  - shadcn/ui form implementation
  - Creates/updates records in 'experts' table

- `src/components/ProcessedProfileViewer.tsx` - Displays processed expert data
  - Referenced in ExpertProfileExtractor

### Types and Models

- `src/types/expert.ts` - Basic expert folder type definition
  - Defines ExpertFolder interface

- In-component interfaces:
  - `ExpertProfile` in ExpertCard.tsx
    - Includes id, name, title, shortBio, expertise, presentations, achievements
  - `ExpertFolder` in ExpertProfileExtractor.tsx
  - `Expert` in Experts.tsx
    - Simple model with id, expert_name, full_name

### API/Database Functions

- `src/lib/supabase/expert-documents.ts`
  - Contains getExpertFolders() function
  - Accesses 'sources_google' table
  - Groups documents by parent folder

- `src/pages/SupabaseAdmin.tsx`
  - References to expert tables in database operations
  - Mentions 'experts' and 'expert_documents' tables

### Archive Components

- `src/components/_archive/ExpertFolderAnalysis.2025-02-16.tsx`
  - Older version of expert folder analysis functionality

- `src/components/_archive/FileTree.2025-02-16.tsx`
  - May contain expert-related file tree implementation

### App Directory Structure

- `src/app/experts/profiler/page.tsx`
  - Newer component structure for expert profiling
  - Minimal implementation with FileTree component

- `src/app/experts/profiler/prompts.ts`
  - AI prompts for expert extraction

### Routing

- In `App.tsx`:
  - `/expert-profiler` route mapped to ExpertProfilerPage
  - No routes for `/experts` or `/experts/:id`
  - Imports ExpertProfiles but doesn't use it in routes

## Database Schema

Based on queries and components, the system appears to use these tables:

- `experts`
  - id
  - expert_name
  - full_name
  - email_address
  - expertise_area
  - experience_years

- `expert_documents`
  - id
  - source_id (references sources_google table)
  - processing_status
  - raw_content
  - processed_content
  - processing_error
  - batch_id

- `sources_google`
  - id
  - name
  - mime_type
  - path
  - parent_path
  - content_extracted
  - web_view_link
  - metadata

## Observations and Issues

### Inconsistencies

- Routes mismatch: ExpertProfilerPage is routed, but core Expert pages aren't
- The ExpertDetail page expects an expertId parameter but no route provides it
- UI components mix direct Tailwind and shadcn/ui component library

### Disconnected Components

- Expert-related components don't have consistent connections
- Multiple mechanisms for expert profile extraction exist
- The ExpertProfileExtractor is comprehensive but may not be connected properly

### Orphaned Functionality

- ExpertProfileExtractor doesn't appear to be used in main navigation
- ExpertDetail shows a skeleton UI but might not be connected to data
- There's an experts folder structure in src/app with minimal implementation
- Several expert-related files have no clear connection to user flows

### Implementation Gaps

- Missing routes for primary expert pages
- Inconsistent approach to expert data model
- Multiple implementations of similar functionality
- No clear relationship between ExpertProfiles and other expert pages

This audit indicates the codebase has undergone several iterations of expert-related functionality, with some components being left orphaned or partially implemented. The newer approach seems to be in the `src/app/experts` directory, but it's minimally implemented compared to the older components.