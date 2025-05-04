# AI Page Documentation

## Overview
The AI page is a comprehensive workshop for managing, creating, and applying AI prompts across the application. It provides tools for prompt management, generation, editing, database storage, and integration with documentation files.

## Features
- **Prompt Library**: Browse and manage local prompt files
- **Prompt Editor**: Create and modify prompt content with markdown support
- **Prompt Generator**: Generate new prompts based on selected files and document types
- **Database Integration**: Store and manage prompts in the Supabase database
- **Relationship Management**: Define relationships between prompts and documentation files
- **Category Management**: Organize prompts into categories
- **Settings Configuration**: Manage Claude API keys and temperature settings

## Implementation Details

### Component Structure
The main component is located at `apps/dhg-improve-experts/src/pages/AI.tsx` and is organized into tabs:

1. **Prompts Library Tab**: Lists all available prompt files
2. **Prompt Editor Tab**: Interface for writing and editing prompts
3. **Prompt Generator Tab**: Tools for generating prompts from existing files
4. **Database Tab**: Manages stored prompts in Supabase
5. **Settings Tab**: Configures API keys and generation parameters

### Data Models
The component uses several TypeScript interfaces:
- `DocumentType`: Represents different document types in the system
- `PromptCategory`: Categories for organizing prompts
- `DatabasePrompt`: Database representation of a stored prompt
- `DocumentationFile`: Files that can be used for context or relationships
- `PromptFile`: Local file system representation of a prompt

### Core Functionality
1. **Local File Management**: Loading and saving prompt files from the filesystem
2. **Prompt Generation**: Creating prompts based on document context
3. **Database Storage**: Persisting prompts and relationships to Supabase
4. **Relationship Management**: Creating links between prompts and documentation
5. **Online/Offline Support**: Graceful degradation when offline

### Technical Details
- Uses shadcn UI components for consistent interface design
- Incorporates markdown for prompt content
- Supports frontmatter for metadata extraction
- Persists settings in localStorage
- Maintains a relationship map between prompts and documentation files
- Handles different data formats (arrays, JSON objects) for flexibility

## Integration Points
- `supabase`: For database operations on prompts and relationships
- `prompt-manager`: Utility for managing prompt files on the filesystem
- Documentation files: Creates links to relevant documentation
- Package.json files: Special handling for project configuration

## User Workflow
1. Browse existing prompts in the library
2. Edit prompts in the editor with markdown
3. Generate prompts from context files
4. Save prompts to the database
5. Establish relationships with documentation files
6. Configure settings for Claude AI integration