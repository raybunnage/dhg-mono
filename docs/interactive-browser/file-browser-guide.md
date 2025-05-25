# DHG-Mono Repository File Browser Guide

This guide explains how to interactively browse and load files from the dhg-mono repository using Claude's file system access capabilities.

## Overview

Claude has been granted access to your dhg-mono repository at `/Users/raybunnage/Documents/github/dhg-mono`. You can use natural language commands to explore the repository structure and load files for analysis or modification.

## Available Commands

### 1. List Directory Contents

Use these commands to explore directory contents:

- `list [directory]` - Shows all files and subdirectories
- `show [directory]` - Alternative to list
- `what's in [directory]` - Natural language alternative

**Examples:**
```
list apps
show packages
what's in the supabase folder
list apps/web/src/components
```

### 2. Search for Files

Find files matching specific patterns:

- `find [pattern]` - Search for files matching a pattern
- `search for [pattern]` - Alternative search command
- `find [pattern] in [directory]` - Search within a specific directory

**Examples:**
```
find *.ts
search for README
find *.json in packages
search for components in apps/web
```

### 3. Load Files

Load file contents into the conversation:

- `load [file]` - Load a single file
- `load [file1] [file2] ...` - Load multiple files
- `read [file]` - Alternative to load
- `show me [file]` - Natural language alternative

**Examples:**
```
load package.json
load apps/web/src/index.ts apps/web/src/App.tsx
read the main README file
show me all config files in the root
```

### 4. View File Information

Get details about files before loading:

- `info [file]` - Show file size, type, and metadata
- `file details [file]` - Alternative command
- `what is [file]` - Natural language query

**Examples:**
```
info package.json
file details apps/web/README.md
what is turbo.json
```

### 5. Directory Tree View

Get a hierarchical view of directory structure:

- `tree [directory]` - Show directory tree
- `structure of [directory]` - Alternative command

**Examples:**
```
tree apps
structure of packages
tree supabase --max-depth 2
```

## Smart Loading Patterns

### By Project Area

Tell Claude what you're working on, and it will suggest relevant files:

**Project Structure & Configuration**
- "I want to understand the project structure"
- "Show me the build configuration"
- "What's the monorepo setup?"

**Application Code**
- "Show me the web app code"
- "I need to see the API implementation"
- "Load the main application entry points"

**Database & Backend**
- "Show me the database schema"
- "Load the Supabase configuration"
- "What are the API routes?"

**Testing & CI/CD**
- "Show me the test setup"
- "Load the CI/CD configuration"
- "What's in the GitHub workflows?"

**Documentation**
- "Show me the documentation"
- "Load all README files"
- "What guides are available?"

### By File Type

Request files by their type:

```
load all TypeScript files in apps/web/src
find all JSON config files
show me all markdown documentation
load all .env example files
```

## Repository Structure Overview

```
dhg-mono/
├── apps/              # Applications (web, mobile, etc.)
├── packages/          # Shared packages and libraries
├── supabase/          # Supabase backend configuration
├── scripts/           # Build and utility scripts
├── docs/              # Documentation
├── prompts/           # AI prompt templates
├── .github/           # GitHub Actions workflows
├── netlify/           # Netlify deployment config
└── [config files]     # Root configuration files
```

## Best Practices

1. **Start Broad, Then Narrow Down**
   - First list the main directory
   - Then explore subdirectories of interest
   - Finally load specific files

2. **Use Search for Discovery**
   - Search for file patterns when unsure of location
   - Use wildcards (*.ts, *.json) to find similar files

3. **Load Related Files Together**
   - Load configuration files with their schemas
   - Load components with their tests
   - Load interfaces with their implementations

4. **Check File Info First**
   - For large files, check size before loading
   - Verify file type and location
   - Ensure you're loading the right version

## Common Tasks

### Understanding the Project
```
load package.json turbo.json pnpm-workspace.yaml
tree . --max-depth 2
```

### Exploring an App
```
list apps
list apps/web
load apps/web/package.json
tree apps/web/src
```

### Finding Configuration
```
find *.config.* in .
find *.env* in .
load all config files
```

### Reviewing Documentation
```
find *.md
load README.md
list docs
```

## Tips

- Use tab completion in your mind - if you mention a partial path, Claude will help complete it
- Ask Claude to explain what files do after loading them
- Request Claude to analyze relationships between files
- Have Claude create new files or modify existing ones as needed

## Getting Started

Try these commands to begin exploring:

1. `list .` - See all root-level files and directories
2. `tree apps --max-depth 2` - Get an overview of your applications
3. `load package.json` - Understand the project dependencies
4. `find README` - Locate all documentation files

---

*Last updated: May 24, 2025*