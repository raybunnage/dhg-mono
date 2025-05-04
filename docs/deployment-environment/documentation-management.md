---
title: "Documentation Management"
date: 2025-03-02
description: "Guide to managing documentation in the DHG monorepo"
category: "development"
status: "active"
---

# Documentation Management Guide

This guide explains how to use the documentation management tools available in the DHG monorepo.

## Overview

The monorepo includes a set of tools to help maintain consistent documentation organization across all projects. These tools follow these key principles:

1. **Single Source of Truth**: Keep shared documentation in a centralized location.
2. **Avoid Duplication**: Link to existing documentation instead of duplicating content.
3. **Project-Specific Content**: Only keep project-specific documentation within individual app folders.
4. **Prompts Separation**: Keep AI prompts in designated prompts folders.

## Available Commands

All documentation management commands can be run using pnpm from the root of the monorepo:

| Command | Description |
|---------|-------------|
| `pnpm docs:report` | Generate a report of all markdown files in the repository |
| `pnpm docs:tree [app-name]` | Display a tree view of documentation files for a specific app |
| `pnpm docs:consolidate` | Move markdown files to their appropriate locations based on best practices |
| `pnpm docs:frontmatter` | Add YAML frontmatter to documentation files to improve organization |
| `pnpm docs:organize` | Run all documentation organization scripts in sequence |

## When to Use

### Generating a Documentation Report

Use `pnpm docs:report` to get a clear picture of how documentation is currently organized:

```bash
pnpm docs:report
```

This creates a `documentation-report.md` file in the app's docs folder with:
- A list of all markdown files
- File locations, types, and sizes
- Summary statistics and recommendations

### Viewing Documentation Structure

Use `pnpm docs:tree` to see a tree representation of documentation files:

```bash
# View documentation for a specific app
pnpm docs:tree dhg-improve-experts

# View documentation for the current app (if no app specified)
pnpm docs:tree
```

### Consolidating Documentation

Use `pnpm docs:consolidate` to automatically reorganize documentation files according to best practices:

```bash
pnpm docs:consolidate
```

This script:
- Keeps README.md files in place
- Moves README-*.md files to the docs folder
- Moves other markdown files to appropriate locations
- Creates references to the new locations

### Adding Frontmatter

Use `pnpm docs:frontmatter` to add or update YAML frontmatter in documentation files:

```bash
pnpm docs:frontmatter
```

Frontmatter provides metadata that helps organize and filter documentation:

```yaml
---
title: "Feature Name"
date: 2025-03-02
description: "Short description"
app: "app-name"  # if applicable
category: "documentation"
status: "active"
---
```

### Complete Documentation Organization

Use `pnpm docs:organize` to run all documentation scripts in sequence:

```bash
pnpm docs:organize
```

This comprehensive process:
1. Generates a report of the current state
2. Shows the documentation tree
3. Consolidates documentation
4. Adds frontmatter
5. Generates a documentation index
6. Creates a final report and tree view

## Documentation Standards

For consistency across the monorepo, follow these standards:

1. **Location**:
   - Shared documentation in the root `/docs` folder
   - Project-specific documentation in each app's `docs` folder
   - Brief project overview in each app's `README.md`

2. **Structure**:
   - Use clear, descriptive filenames
   - Use frontmatter for metadata
   - Follow a consistent heading structure

3. **Cross-linking**:
   - Link to shared documentation rather than duplicating content
   - Use relative links when referring to other documents

4. **Prompts**:
   - Keep AI prompts in designated prompts folders
   - Do not move or consolidate prompt files

## Documentation Index

When you run the organization scripts, a `docs-index.json` file is created in the root docs folder. This index can be used by documentation viewers and dashboards to:

- Display documents by category
- Filter by project or app
- Show related documentation
- Track document status and modifications

## Implementation Details

The documentation tools are implemented as shell scripts in the `apps/dhg-improve-experts/scripts/docs-organization/` directory. These scripts:

- Are non-destructive (preserving original files)
- Skip files in prompts folders
- Generate detailed reports of their actions
- Can be run individually or as a complete process

The documentation index is generated using JavaScript and the gray-matter package to parse frontmatter.