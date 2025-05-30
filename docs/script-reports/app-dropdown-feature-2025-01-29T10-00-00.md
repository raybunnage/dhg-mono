# App/Pipeline Dropdown Feature Implementation

**Date**: 2025-01-29
**Feature**: Added app/pipeline selection to DHG Admin Code task management

## Summary

Implemented a dropdown selector in the task creation form that allows users to specify which application or CLI pipeline a development task relates to. This helps with task organization and filtering.

## Changes Made

### Database Migration
- Created migration `20250601000003_add_app_to_dev_tasks.sql` to add `app` column to `dev_tasks` table
- Column is nullable text field to store the app/pipeline identifier

### Code Updates

#### Task Service (`apps/dhg-admin-code/src/services/task-service.ts`)
- Updated `DevTask` interface to include optional `app` field
- Modified `getTasks` method to support filtering by app
- Updated `createTask` method to accept and store app value

#### Create Task Page (`apps/dhg-admin-code/src/pages/CreateTaskPage.tsx`)
- Added constants for APPS and CLI_PIPELINES
- Implemented dropdown with optgroup sections for apps and pipelines
- Total of 31 options: 5 apps + 26 CLI pipelines

#### Tasks List Page (`apps/dhg-admin-code/src/pages/TasksPage.tsx`)
- Added app filter dropdown to filter tasks by app/pipeline
- Display app badges on task cards using indigo color scheme
- App filter integrates with existing status filter

#### Task Detail Page (`apps/dhg-admin-code/src/pages/TaskDetailPage.tsx`)
- Added app badge display in task header alongside type, priority, and status
- Consistent indigo color scheme for app badges

## Apps and Pipelines Included

### Applications (5)
- dhg-hub
- dhg-audio
- dhg-admin-suite
- dhg-admin-code
- dhg-admin-google

### CLI Pipelines (26)
- ai
- all_pipelines
- analysis
- auth
- classify
- core
- database
- dev_tasks
- document
- document_types
- google_sync
- health
- maintenance
- media-processing
- presentations
- prompt_service
- rate_limit
- reports
- scripts
- sources
- sql_queries
- sync
- transcribe
- viewer
- visualizations
- workflow

## Technical Details

- App field is optional to maintain backward compatibility
- Filter shows "All Apps" by default with count of unique apps
- Empty app values are handled gracefully in UI
- Consistent badge styling across all pages

## Testing Performed

- Database migration executed successfully
- Task creation with app selection works correctly
- Filtering by app functions as expected
- App badges display properly on all pages
- Existing tasks without app field continue to work

## Future Enhancements

- Could add app-specific task templates
- Could show app icons instead of text badges
- Could add analytics by app/pipeline
- Could default to current app when creating tasks from within an app