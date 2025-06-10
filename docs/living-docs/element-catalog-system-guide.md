# Element Catalog System Guide

> Living Document - Last Updated: 2025-06-09
> System for drilling down to specific elements when creating dev tasks

## Overview

The Element Catalog System allows users to select specific features, commands, or services when creating dev tasks. This provides better task targeting and helps track exactly what part of the codebase will be modified.

## Key Features

### 1. **Drill-Down Selection in Task Creation**
When creating a task, after selecting an app, CLI pipeline, or service, users can now:
- For **Apps**: Select specific pages, components, hooks, services, or utilities
- For **CLI Pipelines**: Select specific commands within the pipeline
- For **Services**: Select specific shared services to work on

### 2. **Automatic Element Cataloging**
The system can scan and catalog:
- React components, pages, hooks, and utilities in apps
- CLI commands defined in pipeline scripts
- Shared services in the packages directory

### 3. **Database Tracking**
All cataloged elements are stored in the database with:
- Full path information
- Descriptions extracted from code comments
- Hierarchical relationships (parent/child components)
- Last scan timestamp for freshness

## Usage Guide

### For Users Creating Tasks

1. **Navigate to Create Task Page**
   - Go to `/tasks/new` in dhg-admin-code

2. **Select Worktree and App/Pipeline**
   - Choose your worktree first
   - Select the app or CLI pipeline you'll work on

3. **Choose Specific Element** (Optional)
   - A new dropdown appears showing available elements
   - Elements are grouped by type (pages, components, commands, etc.)
   - Select the specific element you plan to modify

4. **Complete Task Creation**
   - The selected element is linked to your task
   - This helps with tracking and future analysis

### Managing Worktree Associations

To update your worktree associations:
1. Navigate to **WorktreeMappings** page in dhg-admin-code
2. This page allows you to:
   - View all worktree definitions
   - Associate apps with specific worktrees
   - Map CLI pipelines to worktrees
   - Manage service assignments

## CLI Commands for Cataloging

### Scan App Features
```bash
# Scan all apps
./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features

# Scan specific app
./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features --app dhg-hub

# Clean and rescan (removes old entries first)
./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features --app dhg-hub --clean

# Filter by type
./scripts/cli-pipeline/registry/registry-cli.sh scan-app-features --type page
```

### Scan CLI Commands
```bash
# This populates command definitions from pipeline scripts
./scripts/cli-pipeline/registry/registry-cli.sh scan-pipelines
```

### Scan Shared Services
```bash
# This catalogs all shared services
./scripts/cli-pipeline/registry/registry-cli.sh scan-services
```

## Database Schema

### Core Tables

1. **app_features**
   - Stores cataloged app components, pages, hooks, etc.
   - Includes file paths, descriptions, and metadata

2. **dev_task_elements**
   - Links tasks to specific elements
   - Tracks which elements are being worked on

3. **available_task_elements_view**
   - Unified view of all available elements
   - Combines app features, CLI commands, and services

### New Columns in dev_tasks
- `element_target`: JSON object storing the selected element details

## Implementation Details

### Element Catalog Service
Location: `packages/shared/services/element-catalog-service.ts`

Key methods:
- `getAppFeatures(appName)`: Get features for a specific app
- `getCLICommands(pipelineName)`: Get commands for a pipeline
- `getSharedServices()`: Get all shared services
- `linkElementToTask()`: Link an element to a dev task

### Scanner Implementation
Location: `scripts/cli-pipeline/registry/scan-app-features.ts`

Features:
- Scans TypeScript/JavaScript files in apps
- Extracts component names and descriptions
- Detects feature types (page, component, hook, etc.)
- Groups by directory structure
- Handles JSDoc and inline comments

## Benefits

1. **Better Task Clarity**: Know exactly what element will be modified
2. **Impact Analysis**: Track which features are frequently updated
3. **Code Discovery**: Find components and features more easily
4. **Work Attribution**: Link commits to specific features
5. **Dependency Tracking**: Understand relationships between elements

## Future Enhancements

1. **Auto-Detection**: Automatically detect modified elements from git diffs
2. **Visual Browser**: UI for browsing the element catalog
3. **Smart Suggestions**: Recommend related elements based on selection
4. **Coverage Metrics**: Track which elements have tests or documentation
5. **Refactoring Support**: Track element renames and moves

## Troubleshooting

### No Elements Showing
If no elements appear in the dropdown:
1. Run the appropriate scan command (see CLI Commands above)
2. Check that the scanner found files (look at console output)
3. Verify the app/pipeline has the expected file structure

### Missing Features
The scanner looks for files in standard locations:
- `src/**/*.{tsx,ts,jsx,js}`
- `pages/**/*.{tsx,ts,jsx,js}`
- `components/**/*.{tsx,ts,jsx,js}`
- `app/**/*.{tsx,ts,jsx,js}` (Next.js app directory)

If your app uses different conventions, the scanner may need updates.

### Performance
For large apps, scanning may take time. Use the `--app` flag to scan specific apps only.