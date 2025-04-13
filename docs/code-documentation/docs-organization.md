---
title: "Documentation Organization in Monorepo"
date: 2025-03-02
description: "Standards and guidelines for organizing documentation in the DHG monorepo"
app: "dhg-improve-experts"
category: "standards"
status: "active"
---

# Documentation Organization in Monorepo

## Principles

We follow these key principles for documentation organization:

1. **Single Source of Truth**: Keep shared, high-level documentation in the root `/docs` folder.

2. **README.md in Every Project**: Each app/package should have a README.md that:
   - Briefly describes what the project does
   - Links to relevant documentation in the root `/docs` folder
   - Contains quick start instructions
   - Does NOT duplicate information from the root docs

3. **Minimize Project-Specific Docs Folders**: Only create a `/docs` folder within a project if:
   - The documentation is truly specific to that project's implementation
   - The documentation would not make sense in any other context
   - The documentation is extensive enough to warrant its own folder

4. **Cross-Reference Instead of Duplicate**: When a project needs to reference shared concepts, link to the root docs rather than duplicating information.

## Directory Structure

```
/
├── docs/                      # Root documentation folder (main source of truth)
│   ├── feature-a.md           # Feature documentation
│   ├── architecture.md        # Architectural documentation
│   ├── standards/             # Development standards 
│   └── projects/              # Project-specific information
│       └── project-a/
├── apps/
│   ├── project-a/
│   │   ├── README.md          # Basic project info, links to docs/
│   │   └── docs/              # Only if truly project-specific
│   │       └── internal.md    # Implementation details
│   └── project-b/
│       └── README.md
└── packages/
    └── shared-lib/
        └── README.md
```

## Prompts Management

We maintain prompt files in a separate organization pattern:

- `/docs/prompts/` - For shared, general-purpose prompts
- `/apps/[app-name]/public/prompts/` - For app-specific prompts needed at runtime

## Documentation Tools

Several tools are available to help maintain this organization:

```bash
# View current documentation structure
npm run docs:tree [app-name]

# Generate a report of documentation files
npm run docs:report

# Consolidate documentation according to standards
npm run docs:consolidate

# Run all documentation organization scripts
npm run docs:organize
```

## Markdown Standards

- Use frontmatter to indicate metadata:
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

- Use a consistent heading structure
- Include diagrams when helpful (using Mermaid)
- Cross-link related documentation

## Future Development

The documentation dashboard will display these markdown files from the local development machine, making it even more important to maintain a consistent structure that can be programmatically indexed and displayed.