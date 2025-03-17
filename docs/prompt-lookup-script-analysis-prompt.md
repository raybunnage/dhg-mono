# Prompt Lookup: script-analysis-prompt

Generated: 2025-03-17T14:40:33.827Z

Current configuration:
- Using Supabase URL: https://jdksnfkupzywjdfefkyj.supabase.co...
- Using Supabase Key: eyJhb...

=== PROMPT DETAILS FROM DATABASE ===
ID: 43f058d8-6df7-4a01-8f8e-c1eec944defe
Name: script-analysis-prompt
Description: No description
Created: 3/16/2025, 4:27:22 AM
Updated: 3/17/2025, 1:54:12 PM

=== PROMPT CONTENT FROM DATABASE ===
"# Script Analysis and Classification Prompt\n\nYou are an expert script analyzer on a development team tasked with classifying and assessing shell scripts (.sh) and JavaScript scripts (.js) in a monorepo. Your job is to analyze the provided script file and determine its purpose, quality, and relevance, then create a detailed assessment with recommendations.\n\n## Input Context\n\nYou'll be provided with:\n1. The content of a script file to analyze (.sh or .js)\n2. Information about package.json files that may reference the script\n3. The file path and metadata of the script\n4. Optional context about the repository structure and other similar scripts\n\n## Instructions\n\n1. Carefully read the script content.\n2. Determine the primary purpose of the script.\n3. Assess the script's quality, relevancy, and potential value.\n4. Check if the script is referenced in package.json files.\n5. Detect if this script may be a duplicate of another script based on filename and purpose.\n6. Generate appropriate tags that capture the script's key functionality.\n7. Determine a recommended status (ACTIVE, UPDATE_NEEDED, OBSOLETE, DUPLICATE, UNUSED).\n8. Structure your response in the specified JSON format.\n\nYour assessment should consider:\n- How well the script is written (comments, error handling, structure)\n- Whether the script is referenced in package.json files\n- The script's creation/modification date and its recency\n- The script's complexity and completeness\n- Whether the script appears to be a duplicate of another script\n- The script's practical value to developers\n\n## Evaluation Criteria\n\n### Script Status Recommendations\n\n- **ACTIVE**: Script is well-written, clearly useful, referenced in package.json, and recently modified.\n- **UPDATE_NEEDED**: Script is useful but has issues (poor error handling, outdated syntax, unclear purpose, etc.).\n- **OBSOLETE**: Script appears to be outdated, uses deprecated approaches, or hasn't been modified in a long time.\n- **DUPLICATE**: Script functionality appears to be a duplicate of another script in the repository.\n- **UNUSED**: Script isn't referenced in any package.json file and doesn't appear to be actively used.\n\n### Script Quality Assessment (1-10 scale)\n\n- **Code Quality (1-10)**: How well-written is the code? Considerations:\n  - Proper error handling\n  - Good comments and documentation\n  - Clean, consistent style\n  - Well-structured with logical flow\n  - Follows best practices for the language\n\n- **Maintainability (1-10)**: How easy is it to maintain? Considerations:\n  - Clear variable/function names\n  - Modular design\n  - Lack of hardcoded values\n  - Well-documented parameters and return values\n  - Appropriate level of abstraction\n\n- **Utility (1-10)**: How useful is the script? Considerations:\n  - Solves a clear problem\n  - Is referenced in package.json\n  - Has a unique purpose\n  - Handles edge cases appropriately\n  - Works in various environments\n\n- **Documentation (1-10)**: How well is the script documented? Considerations:\n  - Has a clear header/description\n  - Documents parameters and usage\n  - Explains complex logic\n  - Includes examples or usage instructions\n  - Describes expected inputs/outputs\n\n### Usage Status\n\n- **DIRECTLY_REFERENCED**: Script is directly referenced in package.json scripts\n- **INDIRECTLY_REFERENCED**: Script is called by another script that is referenced in package.json\n- **NOT_REFERENCED**: Script is not referenced in any package.json file\n\n## Response Format\n\nProvide your assessment in the following JSON format:\n\n```json\n{\n  \"id\": \"{{auto-generated UUID}}\",\n  \"file_path\": \"{{file_path}}\",\n  \"title\": \"{{script title/name}}\",\n  \"summary\": {\n    \"brief\": \"{{brief summary of the script}}\",\n    \"detailed\": {\n      \"purpose\": \"{{script purpose}}\",\n      \"key_components\": \"{{main functionality}}\",\n      \"practical_application\": \"{{how the script would be used}}\"\n    }\n  },\n  \"language\": \"{{sh|js|bash|node}}\",\n  \"ai_generated_tags\": [\"{{tag1}}\", \"{{tag2}}\", \"{{tag3}}\", \"{{tag4}}\", \"{{tag5}}\"],\n  \"manual_tags\": null,\n  \"last_modified_at\": \"{{last_modified_date if available}}\",\n  \"last_indexed_at\": \"{{current_datetime}}\",\n  \"file_hash\": \"{{file_hash if available}}\",\n  \"metadata\": {\n    \"size\": {{file_size_in_bytes}},\n    \"has_shebang\": {{true|false}},\n    \"shebang\": \"{{shebang_line}}\",\n    \"is_executable\": {{true|false}}\n  },\n  \"created_at\": \"{{creation_date if available, otherwise current_datetime}}\",\n  \"updated_at\": \"{{current_datetime}}\",\n  \"is_deleted\": false,\n  \"script_type_id\": \"{{matched script type id or null}}\",\n  \"package_json_references\": [\n    {\n      \"file\": \"{{package.json location}}\",\n      \"script_key\": \"{{script key in package.json}}\",\n      \"command\": \"{{full command}}\"\n    }\n  ],\n  \"ai_assessment\": {\n    \"script_type\": \"{{UTILITY|DEPLOYMENT|DATABASE|BUILD|SETUP|OTHER}}\",\n    \"script_quality\": {\n      \"code_quality\": {{1-10 score}},\n      \"maintainability\": {{1-10 score}},\n      \"utility\": {{1-10 score}},\n      \"documentation\": {{1-10 score}}\n    },\n    \"current_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of current relevance score}}\"\n    },\n    \"potential_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of potential future relevance}}\"\n    },\n    \"usage_status\": \"{{DIRECTLY_REFERENCED|INDIRECTLY_REFERENCED|NOT_REFERENCED}}\",\n    \"status_recommendation\": \"{{ACTIVE|UPDATE_NEEDED|OBSOLETE|DUPLICATE|UNUSED}}\",\n    \"possible_duplicates\": [\n      \"{{similar_script_path1}}\",\n      \"{{similar_script_path2}}\"\n    ],\n    \"confidence\": {{1-10 score}},\n    \"reasoning\": \"{{explanation of the overall assessment and recommendations}}\"\n  },\n  \"assessment_quality_score\": {{1-10 overall quality score}},\n  \"assessment_created_at\": \"{{current_datetime}}\",\n  \"assessment_updated_at\": \"{{current_datetime}}\",\n  \"assessment_model\": \"Claude 3.7 Sonnet\",\n  \"assessment_version\": 1,\n  \"assessment_date\": \"{{current_date}}\"\n}\n```\n\n## Example Workflow\n\nWhen analyzing a script, follow this general process:\n1. Understand the script's content, purpose, and functionality\n2. Check if it's referenced in package.json files\n3. Evaluate code quality, comments, and error handling\n4. Assess relevance to current development practices\n5. Generate meaningful tags based on content\n6. Check for potential duplicates based on filename and functionality\n7. Make a status recommendation with supporting reasoning\n\nFor JSONB storage compatibility, ensure:\n- All JSON is properly formatted and validated\n- Nested objects are used for structured data\n- Text fields have reasonable length limitations\n- Date fields follow ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sss+00:00)\n- Numeric scores are integers in the specified ranges\n\n## Example Assessment\n\nHere's an abbreviated example assessment for a database backup script:\n\n```json\n{\n  \"title\": \"Database Backup Script\",\n  \"summary\": {\n    \"brief\": \"Automated PostgreSQL database backup script with compression and retention policies\",\n    \"detailed\": {\n      \"purpose\": \"Create automated backups of PostgreSQL databases\",\n      \"key_components\": \"Database connection, backup creation, compression, rotation\",\n      \"practical_application\": \"Used in CI/CD pipeline for nightly database backups\"\n    }\n  },\n  \"language\": \"bash\",\n  \"ai_generated_tags\": [\"database\", \"backup\", \"postgres\", \"automation\", \"retention\"],\n  \"ai_assessment\": {\n    \"script_type\": \"DATABASE\",\n    \"script_quality\": {\n      \"code_quality\": 8,\n      \"maintainability\": 7,\n      \"utility\": 9,\n      \"documentation\": 8\n    },\n    \"usage_status\": \"DIRECTLY_REFERENCED\",\n    \"status_recommendation\": \"ACTIVE\",\n    \"reasoning\": \"This script is well-written, actively used in package.json, and serves a critical infrastructure purpose. The error handling could be improved, but overall it's a high-quality script that should be maintained.\"\n  }\n}\n```\n"

=== RELATIONSHIPS (1) ===

Relationship ID: 455ba75b-5173-47fa-b8fc-6c8a7557cd1f
Type: reference
Asset Path: docs/script-report.md
Context: this is provided for the metadata about the scripts - such as created date, updated date, etc. to help in assessing the value of a particular scipt
File Content (182 lines, 11534 bytes):
---
# Shell Script Report

Generated: Sun Mar 16 18:50:43 PDT 2025

## Overview

This report shows all shell script files (.sh) found in the repository, organized hierarchically by directory.
It includes information about each script's executable status, size, and last modification date.

**Note**: The following directories and patterns are excluded from this report:
- _archive/ or archive/ directories (archived code)
- scripts-*/ directories (backup scripts)
- file_types/ directory (file type examples) 
- backups/ or .backups/ directories
- Standard exclusions: node_modules/, .git/, dist/, build/, coverage/

## Summary

- **Total shell scripts:**       62
- **Executable scripts:**       56
- **Non-executable scripts:**        6
- **Root-level scripts:**        0

## Make All Scripts Executable

To make all shell scripts in the repository executable, run:

```bash
find . -name "*.sh" -type f -exec chmod +x {} \;
```

## Scripts Directory (Hierarchical View)

- 📁 **scripts/**
  - 📜 [apply-rls-migrations.sh](/scripts/apply-rls-migrations.sh) - ❌ Not executable - 2025-02-28 21:35 (1365 bytes)
    - Shebang: `#!/bin/bash`
    - To make executable: `chmod +x scripts/apply-rls-migrations.sh`
  - 📜 [archive-pdf-implementation.sh](/scripts/archive-pdf-implementation.sh) - ✅ Executable - 2025-02-17 19:56 (2165 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [backup-env.sh](/scripts/backup-env.sh) - ✅ Executable - 2025-03-16 13:32 (728 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [classify-markdowns.sh](/scripts/classify-markdowns.sh) - ✅ Executable - 2025-03-10 17:44 (20347 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [clear-vite-cache.sh](/scripts/clear-vite-cache.sh) - ❌ Not executable - 2025-02-23 05:41 (362 bytes)
    - Shebang: `#!/bin/bash`
    - To make executable: `chmod +x scripts/clear-vite-cache.sh`
  - 📜 [create-migration.sh](/scripts/create-migration.sh) - ✅ Executable - 2025-02-17 17:41 (1477 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [deploy.sh](/scripts/deploy.sh) - ✅ Executable - 2025-02-10 17:31 (583 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [file-reader.sh](/scripts/file-reader.sh) - ✅ Executable - 2025-03-10 16:14 (2350 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [get-git-info.sh](/scripts/get-git-info.sh) - ✅ Executable - 2025-02-17 17:41 (306 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [markdown-report.sh](/scripts/markdown-report.sh) - ✅ Executable - 2025-03-07 00:26 (5224 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [migrate-cli-scripts.sh](/scripts/migrate-cli-scripts.sh) - ❌ Not executable - 2025-03-16 14:54 (527 bytes)
    - Shebang: `#!/bin/bash`
    - To make executable: `chmod +x scripts/migrate-cli-scripts.sh`
  - 📜 [set-permissions.sh](/scripts/set-permissions.sh) - ✅ Executable - 2025-02-22 20:59 (601 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [setup-cli-package.sh](/scripts/setup-cli-package.sh) - ❌ Not executable - 2025-03-15 21:11 (4867 bytes)
    - Shebang: `#!/bin/bash`
    - To make executable: `chmod +x scripts/setup-cli-package.sh`
  - 📜 [simple-db-query.sh](/scripts/simple-db-query.sh) - ❌ Not executable - 2025-03-09 15:09 (1 bytes)
    - Shebang: `No shebang`
    - To make executable: `chmod +x scripts/simple-db-query.sh`
  - 📜 [test-gitignore.sh](/scripts/test-gitignore.sh) - ✅ Executable - 2025-03-16 13:34 (621 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [track.sh](/scripts/track.sh) - ✅ Executable - 2025-03-02 11:13 (1192 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [update-docs-database.sh](/scripts/update-docs-database.sh) - ✅ Executable - 2025-03-09 15:09 (26515 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [verify-cli-scripts.sh](/scripts/verify-cli-scripts.sh) - ✅ Executable - 2025-03-16 14:58 (712 bytes)
    - Shebang: `#!/bin/bash`
  - 📁 **app-management/**
    - 📜 [backup-configs.sh](/scripts/app-management/backup-configs.sh) - ✅ Executable - 2025-02-12 14:14 (2721 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [copy-lovable-app.sh](/scripts/app-management/copy-lovable-app.sh) - ✅ Executable - 2025-02-10 17:31 (1705 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [list-backups.sh](/scripts/app-management/list-backups.sh) - ✅ Executable - 2025-02-17 17:41 (2197 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [restore-configs.sh](/scripts/app-management/restore-configs.sh) - ✅ Executable - 2025-02-12 14:14 (2234 bytes)
      - Shebang: `#!/bin/bash`
  - 📁 **cli-pipeline/**
    - 📜 [analyze-scripts.sh](/scripts/cli-pipeline/analyze-scripts.sh) - ✅ Executable - 2025-03-16 13:40 (2843 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [fix-ai-integration.sh](/scripts/cli-pipeline/fix-ai-integration.sh) - ✅ Executable - 2025-03-16 18:31 (5901 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [fix-batch-analyze.sh](/scripts/cli-pipeline/fix-batch-analyze.sh) - ✅ Executable - 2025-03-16 18:43 (3325 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [fix-permissions.sh](/scripts/cli-pipeline/fix-permissions.sh) - ✅ Executable - 2025-03-16 17:40 (26661 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [import-script-analysis.sh](/scripts/cli-pipeline/import-script-analysis.sh) - ✅ Executable - 2025-03-16 12:49 (11091 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [load-env.sh](/scripts/cli-pipeline/load-env.sh) - ✅ Executable - 2025-03-16 13:40 (3770 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [run-ai-analyze.sh](/scripts/cli-pipeline/run-ai-analyze.sh) - ✅ Executable - 2025-03-16 18:48 (4152 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [script-report.sh](/scripts/cli-pipeline/script-report.sh) - ✅ Executable - 2025-03-16 14:05 (12327 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [setup-prompts.sh](/scripts/cli-pipeline/setup-prompts.sh) - ✅ Executable - 2025-03-16 12:49 (1 bytes)
      - Shebang: `No shebang`
    - 📜 [test-env.sh](/scripts/cli-pipeline/test-env.sh) - ✅ Executable - 2025-03-16 13:42 (2901 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [validate-ai-assets.sh](/scripts/cli-pipeline/validate-ai-assets.sh) - ✅ Executable - 2025-03-16 13:41 (15200 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [validate-prompt-relationships.sh](/scripts/cli-pipeline/validate-prompt-relationships.sh) - ✅ Executable - 2025-03-16 12:49 (27434 bytes)
      - Shebang: `#!/bin/bash`
  - 📁 **deployment/**
    - 📜 [backup-env-configs.sh](/scripts/deployment/backup-env-configs.sh) - ✅ Executable - 2025-02-10 17:31 (609 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [deploy-app.sh](/scripts/deployment/deploy-app.sh) - ✅ Executable - 2025-02-10 17:31 (911 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [setup-environments.sh](/scripts/deployment/setup-environments.sh) - ✅ Executable - 2025-02-10 17:31 (902 bytes)
      - Shebang: `#!/bin/bash`
  - 📁 **supabase/**
    - 📜 [complete-migration.sh](/scripts/supabase/complete-migration.sh) - ✅ Executable - 2025-02-17 17:41 (554 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [run-migration.sh](/scripts/supabase/run-migration.sh) - ✅ Executable - 2025-02-17 17:41 (5356 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [start-psql.sh](/scripts/supabase/start-psql.sh) - ✅ Executable - 2025-02-17 17:41 (1255 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [update-schema.sh](/scripts/supabase/update-schema.sh) - ✅ Executable - 2025-02-23 07:05 (586 bytes)
      - Shebang: `#!/bin/bash`
  - 📁 **whisper/**
    - 📜 [setup.sh](/scripts/whisper/setup.sh) - ✅ Executable - 2025-02-22 17:40 (2711 bytes)
      - Shebang: `#!/bin/bash`
    - 📁 **.venv-whisper/**
      - 📁 **lib/**
        - 📁 **python3.11/**
          - 📁 **site-packages/**
            - 📁 **tqdm/**
              - 📜 [completion.sh](/scripts/whisper/.venv-whisper/lib/python3.11/site-packages/tqdm/completion.sh) - ✅ Executable - 2025-02-22 17:38 (946 bytes)
                - Shebang: `#!/usr/bin/env bash`

## Apps Directory (Hierarchical View)

- 📁 **apps/**
  - 📁 **dhg-improve-experts/**
    - 📜 [apply_export_functions.sh](/apps/dhg-improve-experts/apply_export_functions.sh) - ✅ Executable - 2025-03-02 16:05 (944 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [apply_export_functions_migration.sh](/apps/dhg-improve-experts/apply_export_functions_migration.sh) - ✅ Executable - 2025-03-02 16:04 (1156 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [apply_function_registry_migrations.sh](/apps/dhg-improve-experts/apply_function_registry_migrations.sh) - ✅ Executable - 2025-03-01 10:04 (979 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [apply_guts_migrations.sh](/apps/dhg-improve-experts/apply_guts_migrations.sh) - ✅ Executable - 2025-03-01 06:43 (456 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [apply_migrations.sh](/apps/dhg-improve-experts/apply_migrations.sh) - ✅ Executable - 2025-03-01 05:53 (687 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [apply_script_migrations.sh](/apps/dhg-improve-experts/apply_script_migrations.sh) - ✅ Executable - 2025-03-15 22:12 (1444 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [archive-expert-components.sh](/apps/dhg-improve-experts/archive-expert-components.sh) - ✅ Executable - 2025-02-28 19:23 (2109 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [dev-start.sh](/apps/dhg-improve-experts/dev-start.sh) - ✅ Executable - 2025-03-08 10:29 (725 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [remove_user_references_code.sh](/apps/dhg-improve-experts/remove_user_references_code.sh) - ✅ Executable - 2025-02-28 13:59 (6361 bytes)
      - Shebang: `No shebang`
    - 📜 [run_investigate_sync.sh](/apps/dhg-improve-experts/run_investigate_sync.sh) - ❌ Not executable - 2025-03-01 15:32 (2149 bytes)
      - Shebang: `#!/bin/bash`
      - To make executable: `chmod +x apps/dhg-improve-experts/run_investigate_sync.sh`
    - 📜 [start-markdown-server.sh](/apps/dhg-improve-experts/start-markdown-server.sh) - ✅ Executable - 2025-03-07 00:47 (618 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [test-fix.sh](/apps/dhg-improve-experts/test-fix.sh) - ✅ Executable - 2025-03-15 22:40 (1857 bytes)
      - Shebang: `#!/bin/bash`
    - 📁 **scripts/**
      - 📜 [setup_whisper.sh](/apps/dhg-improve-experts/scripts/setup_whisper.sh) - ✅ Executable - 2025-02-22 17:21 (586 bytes)
        - Shebang: `#!/bin/bash`
      - 📁 **docs-organization/**
        - 📜 [add-frontmatter.sh](/apps/dhg-improve-experts/scripts/docs-organization/add-frontmatter.sh) - ✅ Executable - 2025-03-02 12:22 (2026 bytes)
          - Shebang: `#!/bin/bash`
        - 📜 [consolidate-docs.sh](/apps/dhg-improve-experts/scripts/docs-organization/consolidate-docs.sh) - ✅ Executable - 2025-03-02 12:22 (3529 bytes)
          - Shebang: `#!/bin/bash`
        - 📜 [generate-docs-report.sh](/apps/dhg-improve-experts/scripts/docs-organization/generate-docs-report.sh) - ✅ Executable - 2025-03-02 12:57 (14100 bytes)
          - Shebang: `#!/bin/bash`
        - 📜 [run-all.sh](/apps/dhg-improve-experts/scripts/docs-organization/run-all.sh) - ✅ Executable - 2025-03-02 12:05 (2171 bytes)
          - Shebang: `#!/bin/bash`
        - 📜 [simple-report.sh](/apps/dhg-improve-experts/scripts/docs-organization/simple-report.sh) - ✅ Executable - 2025-03-02 13:05 (5531 bytes)
          - Shebang: `#!/bin/bash`
        - 📜 [tree-docs.sh](/apps/dhg-improve-experts/scripts/docs-organization/tree-docs.sh) - ✅ Executable - 2025-03-02 12:22 (2573 bytes)
          - Shebang: `#!/bin/bash`

---

=== PROMPT FILE ===
File: /Users/raybunnage/Documents/github/dhg-mono/prompts/script-analysis-prompt.md
---
# Script Analysis Prompt

## Task

Analyze the provided script file to determine its purpose, functionality, and assess its quality, relevancy, and potential value to the project. Categorize the script into predefined document types.

## Context

You are analyzing a script file from a codebase to determine its document type, purpose, and overall quality. Your assessment will help organize and manage scripts in the codebase, identify potential duplicates, and ensure scripts are properly documented and maintained.

## Instructions

1. **Analyze the script content, purpose, and functionality**
   - Determine what the script does
   - Identify the technologies and libraries used
   - Note any inputs, outputs, or side effects

2. **Determine the script's primary purpose**
   - Categorize into one of the document types:
     - AI: Related to AI/ML models, prompts, and configurations
     - Integration: For external system integrations
     - Operations: For operational tasks and infrastructure
     - Development: For development tools and processes

3. **Assess quality, relevancy, and potential value**
   - Code quality: Is the code well-written, documented, and maintainable?
   - Relevancy: Is the script still relevant to the project?
   - Potential value: How valuable is this script to the project?

4. **Check for package.json references**
   - Is this script referenced in any package.json files?
   - Is it part of a defined workflow or process?

5. **Detect potential duplicates**
   - Does this script have similar functionality to other scripts?
   - Is this potentially a duplicate or variation of another script?

6. **Generate appropriate tags**
   - Create tags that describe the script's purpose, technology, and functionality

7. **Recommend a status**
   - ACTIVE: Currently in use and up-to-date
   - UPDATE_NEEDED: Still useful but requires updates
   - OBSOLETE: No longer needed or outdated
   - DUPLICATE: Duplicates functionality found elsewhere
   - UNUSED: Not referenced or used in the project

## Output Format

Provide your analysis in the following JSON format:

```json
{
  "metadata": {
    "file_path": "path/to/script.js",
    "title": "Descriptive title of the script",
    "language": "javascript|typescript|shell|python|etc",
    "document_type": "AI|Integration|Operations|Development"
  },
  "assessment": {
    "summary": "Brief summary of what the script does",
    "tags": ["tag1", "tag2", "tag3"],
    "quality": {
      "code_quality": 1-10,
      "maintainability": 1-10,
      "utility": 1-10,
      "documentation": 1-10
    },
    "relevance": {
      "score": 1-10,
      "reasoning": "Explanation of relevance score"
    },
    "referenced": true|false,
    "potential_duplicates": ["path/to/similar/script1", "path/to/similar/script2"],
    "status": {
      "recommendation": "ACTIVE|UPDATE_NEEDED|OBSOLETE|DUPLICATE|UNUSED",
      "confidence": 1-10,
      "reasoning": "Explanation of status recommendation"
    }
  }
}
```

Ensure your assessment is objective, thorough, and provides clear reasoning for your categorization and recommendations.
---

=== PROMPT METADATA ===
{
  "hash": "JTIzJTIwU2NyaXB0JTIwQW5hbHlzaXMlMjBhbmQl",
  "usage": {
    "inputSchema": {},
    "outputSchema": "text"
  },
  "source": {
    "gitInfo": {
      "branch": "main",
      "commitId": "none"
    },
    "fileName": "script-analysis-prompt.md",
    "createdAt": "2025-03-16T04:27:21.845Z"
  },
  "aiEngine": {
    "model": "claude-3-sonnet-20240229",
    "maxTokens": 4000,
    "temperature": 0.7
  },
  "function": {
    "purpose": "",
    "dependencies": [],
    "estimatedCost": "",
    "successCriteria": ""
  },
  "databaseQuery": "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations');",
  "relatedAssets": [
    "2e22fb39-c6fb-4d32-a2c0-86ec2971fac5",
    "pkg-root",
    "pkg-dhg-improve-experts",
    "00000000-0000-4000-a000-000000000001",
    "00000000-0000-4000-a000-000000000005"
  ],
  "packageJsonFiles": [
    {
      "id": "00000000-0000-4000-a000-000000000001",
      "path": "/package.json",
      "title": "Root package.json",
      "context": "abc",
      "settings": {
        "description": "",
        "document_type_id": "d2480114-93b8-4f8b-8910-6b6d5f68d8a5",
        "relationship_type": "reference",
        "relationship_context": "abc"
      },
      "description": "",
      "document_type_id": "d2480114-93b8-4f8b-8910-6b6d5f68d8a5",
      "relationship_type": "reference"
    },
    {
      "id": "00000000-0000-4000-a000-000000000005",
      "path": "/apps/dhg-improve-experts/package.json",
      "title": "dhg-improve-experts package.json",
      "context": "",
      "settings": {
        "description": "Package.json file relationship",
        "document_type_id": null,
        "relationship_type": "reference",
        "relationship_context": ""
      },
      "description": "Package.json file relationship",
      "document_type_id": null,
      "relationship_type": "reference"
    }
  ]
}

=== DATABASE QUERY RESULTS ===
Query: SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations');
Executing query: SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations');
Detected document_types query - using direct table access
Querying document_types table for categories: AI, Operations
[
  {
    "id": "a1dddf8e-1264-4ec0-a5af-52eafb536ee3",
    "document_type": "Deployment Script",
    "current_num_of_type": 0,
    "description": "Scripts for deploying applications to various environments, managing environment configurations, and provisioning resources.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-sh,application/javascript",
    "file_extension": "sh,js,bash,py",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:15:07.199+00:00",
    "updated_at": "2025-03-16T03:15:07.199+00:00",
    "required_fields": [
      "deployment_target",
      "script_purpose",
      "author",
      "version"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "identify_security_risks": true,
      "check_rollback_mechanisms": true,
      "detect_service_dependencies": true,
      "identify_deployment_targets": true,
      "detect_environment_variables": true,
      "extract_resource_requirements": true
    },
    "validation_rules": {
      "should_have_comments": true,
      "should_include_logging": true,
      "should_check_prerequisites": true,
      "should_have_error_handling": true,
      "should_have_timeout_handling": true,
      "should_have_environment_checks": true
    }
  },
  {
    "id": "f7e83857-8bb8-4b18-9d8f-16d5cb783650",
    "document_type": "Environment Setup Script",
    "current_num_of_type": 0,
    "description": "Scripts for setting up development environments, installing dependencies, configuring permissions, and preparing workspaces.",
    "mime_type": "application/x-shellscript,text/javascript,application/x-powershell,application/x-bat,text/x-python",
    "file_extension": "sh,js,ps1,bat,py",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:23:20.197+00:00",
    "updated_at": "2025-03-16T03:23:20.197+00:00",
    "required_fields": [
      "script_purpose",
      "target_environment",
      "prerequisite_checks"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analyze_idempotency": true,
      "extract_execution_flow": true,
      "flag_security_concerns": true,
      "identify_error_handling": true,
      "identify_permission_changes": true,
      "check_environment_validation": true,
      "detect_resource_requirements": true,
      "detect_dependency_installation": true
    },
    "validation_rules": {
      "should_be_idempotent": true,
      "should_have_comments": true,
      "should_have_version_info": true,
      "should_check_prerequisites": true,
      "should_have_error_handling": true,
      "should_have_usage_instructions": true
    }
  },
  {
    "id": "53f42e7d-78bd-4bde-8106-dc12a4835695",
    "document_type": "Document Processing Script",
    "current_num_of_type": 0,
    "description": "Scripts for generating, analyzing, or transforming documentation files such as markdown documents, reports, and documentation databases.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-python,text/x-ruby",
    "file_extension": "sh,js,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:17:54.567+00:00",
    "updated_at": "2025-03-16T03:36:41.973+00:00",
    "required_fields": [
      "script_purpose",
      "input_format",
      "output_format",
      "execution_instructions"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_file_operations": true,
      "check_database_integration": true,
      "identify_markdown_processing": true,
      "extract_documentation_patterns": true,
      "identify_report_generation_logic": true,
      "detect_document_classification_methods": true
    },
    "validation_rules": {
      "should_specify_dependencies": true,
      "should_handle_file_not_found": true,
      "should_document_output_format": true,
      "should_include_error_handling": true,
      "should_have_usage_instructions": true
    }
  },
  {
    "id": "95390c42-2048-41f7-ba30-59d48d3f1075",
    "document_type": "AI Workflow Script",
    "current_num_of_type": 0,
    "description": "Scripts that manage AI-related workflows, such as model serving, prompt processing, or AI service integration.",
    "mime_type": "application/x-shellscript,text/javascript,text/x-python",
    "file_extension": "sh,js,py",
    "document_type_counts": 0,
    "category": "AI",
    "created_at": "2025-03-16T03:29:47.413+00:00",
    "updated_at": "2025-03-16T03:29:47.413+00:00",
    "required_fields": [
      "script_purpose",
      "ai_model",
      "input_format",
      "output_handling"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_ai_service_calls": true,
      "extract_model_parameters": true,
      "identify_prompt_templates": true,
      "check_token_usage_estimation": true,
      "identify_error_handling_patterns": true
    },
    "validation_rules": {
      "should_include_logging": true,
      "should_sanitize_user_inputs": true,
      "should_handle_api_rate_limits": true,
      "should_include_error_handling": true,
      "should_document_model_parameters": true
    }
  },
  {
    "id": "4fdbd8be-fe5a-4341-934d-2b6bd43be7be",
    "document_type": "CI CD Pipeline Script",
    "current_num_of_type": 0,
    "description": "Scripts designed to run in continuous integration and deployment pipelines, including testing, validation, and release automation.",
    "mime_type": "application/x-shellscript,text/javascript,text/yaml,text/x-python,text/x-ruby,application/x-powershell",
    "file_extension": "sh,js,yml,yaml,ps1,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:24:20.474+00:00",
    "updated_at": "2025-03-16T03:32:46.456+00:00",
    "required_fields": [
      "script_purpose",
      "pipeline_stage",
      "execution_environment"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_ci_platform": {
        "platforms": [
          "github_actions",
          "jenkins",
          "gitlab_ci",
          "azure_devops",
          "circle_ci",
          "travis_ci"
        ]
      },
      "detect_security_risks": true,
      "analyze_error_handling": true,
      "detect_pipeline_stages": true,
      "identify_resource_usage": true,
      "identify_test_execution": true,
      "check_notification_mechanisms": true,
      "extract_environment_variables": true
    },
    "validation_rules": {
      "should_be_idempotent": true,
      "should_include_comments": true,
      "should_have_clear_exit_codes": true,
      "should_have_timeout_handling": true,
      "should_log_execution_progress": true,
      "should_handle_errors_gracefully": true
    }
  },
  {
    "id": "561a86b0-7064-4c20-a40e-2ec6905c4a42",
    "document_type": "Database Management Script",
    "current_num_of_type": 0,
    "description": "Scripts for database operations including migrations, schema management, backups, and query execution.",
    "mime_type": "application/x-shellscript,text/javascript,application/sql,text/x-python,text/x-ruby",
    "file_extension": "sh,js,sql,py,rb",
    "document_type_counts": 0,
    "category": "Operations",
    "created_at": "2025-03-16T03:13:54.493+00:00",
    "updated_at": "2025-03-16T03:37:15.774+00:00",
    "required_fields": [
      "script_purpose",
      "database_type",
      "execution_environment"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_db_operations": true,
      "identify_sql_queries": true,
      "detect_error_handling": true,
      "analyze_schema_changes": true,
      "identify_security_risks": true,
      "analyze_query_performance": true,
      "check_transaction_handling": true,
      "detect_sensitive_data_handling": true
    },
    "validation_rules": {
      "should_have_logging": true,
      "should_have_error_handling": true,
      "should_document_db_dependencies": true,
      "should_include_rollback_mechanism": true,
      "should_validate_connection_parameters": true
    }
  }
]

=== PACKAGE.JSON FILES ===

Package.json: /package.json
Title: Root package.json
Context: abc
File Content (72 lines, 4165 bytes):
---
{
  "name": "dhg-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "test": "turbo run test",
    "test:run": "turbo run test:run",
    "git:info": "./scripts/get-git-info.sh",
    "list-backups": "./scripts/app-management/list-backups.sh",
    "list-backups-date": "./scripts/app-management/list-backups.sh",
    "deploy:dev": "./scripts/deploy.sh dhg-a development",
    "deploy:prod": "./scripts/deploy.sh dhg-a production",
    "env:backup": "./scripts/backup-env.sh",
    "env:restore": "./scripts/restore-env.sh",
    "deploy:init": "./scripts/deployment/setup-environments.sh",
    "deploy:app": "./scripts/deployment/deploy-app.sh",
    "deploy:backup": "./scripts/deployment/backup-env-configs.sh",
    "copy-app": "./scripts/app-management/copy-lovable-app.sh",
    "backup-configs": "./scripts/app-management/backup-configs.sh",
    "restore-configs": "./scripts/app-management/restore-configs.sh",
    "deploy:dhg-a:development": "./scripts/deployment/deploy-app.sh dhg-a development",
    "deploy:dhg-a:prod": "./scripts/deployment/deploy-app.sh dhg-a production",
    "deploy:dhg-a:preview": "./scripts/deployment/deploy-app.sh dhg-a preview",
    "deploy:dhg-b:dev": "./scripts/deployment/deploy-app.sh dhg-b development",
    "deploy:dhg-b:prod": "./scripts/deployment/deploy-app.sh dhg-b production",
    "deploy:dhg-b:preview": "./scripts/deployment/deploy-app.sh dhg-b preview",
    "deploy:dhg-hub-lovable:dev": "./scripts/deployment/deploy-app.sh dhg-hub-lovable development",
    "deploy:dhg-hub-lovable:prod": "./scripts/deployment/deploy-app.sh dhg-hub-lovable production",
    "deploy:dhg-hub-lovable:preview": "./scripts/deployment/deploy-app.sh dhg-hub-lovable preview",
    "reset:sources-google": "scripts/reset-sources-google.sh",
    "db:migrate": "./scripts/supabase/run-migration.sh up",
    "db:rollback": "./scripts/supabase/run-migration.sh down",
    "db:list": "./scripts/supabase/run-migration.sh list",
    "db:repair": "./scripts/supabase/run-migration.sh repair",
    "db:repair-applied": "./scripts/supabase/run-migration.sh repair-applied",
    "db:check": "supabase db diff --linked",
    "migration:new": "./scripts/create-migration.sh",
    "db:psql": "./scripts/supabase/start-psql.sh",
    "db:psql:check": "./scripts/supabase/start-psql.sh \"SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;\"",
    "db:psql:migrations": "./scripts/supabase/start-psql.sh \"SELECT version, name, statements[1] as first_statement FROM supabase_migrations.schema_migrations ORDER BY version DESC;\"",
    "db:psql:describe-migrations": "./scripts/supabase/start-psql.sh \"\\d supabase_migrations.schema_migrations;\"",
    "tree": "node scripts/show-tree.js",
    "gen:types": "supabase gen types typescript --local > supabase/types.ts",
    "generate-types": "tsx scripts/generate-types.ts",
    "db:types": "pnpm db:types && pnpm db:schema",
    "db:schema": "pnpm supabase db pull --project-id jdksnfkupzywjdfefkyj > supabase/schema/schema.sql",
    "precommit": "pnpm db:update",
    "setup:permissions": "./scripts/set-permissions.sh",
    "docs:report": "./scripts/markdown-report.sh",
    "docs:tree": "./apps/dhg-improve-experts/scripts/docs-organization/tree-docs.sh",
    "docs:organize": "./apps/dhg-improve-experts/scripts/docs-organization/run-all.sh",
    "docs:consolidate": "./apps/dhg-improve-experts/scripts/docs-organization/consolidate-docs.sh",
    "docs:frontmatter": "./apps/dhg-improve-experts/scripts/docs-organization/add-frontmatter.sh",
    "db:export-functions": "./scripts/export-db-functions.js",
    "db:search-functions": "./scripts/search-db-functions.js",
    "db:generate-function-types": "./scripts/generate-function-types.js",
    "db:check-export-function": "./scripts/check-export-function.js"
  },
  "bin": {
    "dhg-tree": "./scripts/show-tree.js"
  },
  "devDependencies": {
    "@anthropic-ai/claude-code": "^0.2.9",
    "gray-matter": "^4.0.3",
    "netlify-cli": "18.0.4",
    "supabase": "2.12.1",
    "turbo": "^1.12.4"
  }
}
---

Package.json: /apps/dhg-improve-experts/package.json
Title: dhg-improve-experts package.json
Context: No context
File Content (139 lines, 5076 bytes):
---
{
  "name": "dhg-improve-experts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "clean": "rm -rf node_modules",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage",
    "docs:report": "./scripts/docs-organization/simple-report.sh",
    "docs:tree": "./scripts/docs-organization/tree-docs.sh",
    "docs:organize": "./scripts/docs-organization/run-all.sh",
    "docs:consolidate": "./scripts/docs-organization/consolidate-docs.sh",
    "docs:frontmatter": "./scripts/docs-organization/add-frontmatter.sh",
    "markdown-server": "node md-server.mjs",
    "dev:with-markdown": "npm run markdown-server",
    "cli:build": "cd scripts/cli && npm install && npm run build",
    "cli:classify": "./scripts/classify-markdowns.sh",
    "cli:examine": "./scripts/examine-markdown.sh",
    "cli:workflow": "./scripts/run-workflow.sh",
    "cli:workflow:execute": "./scripts/run-workflow.sh --execute"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.6.2",
    "@fortawesome/fontawesome-svg-core": "^6.4.2",
    "@fortawesome/free-regular-svg-icons": "^6.4.2",
    "@fortawesome/free-solid-svg-icons": "^6.4.2",
    "@fortawesome/react-fontawesome": "^0.2.0",
    "@monaco-editor/react": "^4.6.0",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-aspect-ratio": "^1.0.3",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-context-menu": "^2.1.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@supabase/supabase-js": "^2.26.0",
    "@tanstack/react-table": "^8.9.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cmdk": "^0.2.0",
    "date-fns": "^2.30.0",
    "ffmpeg.wasm": "^0.11.0",
    "googleapis": "^118.0.0",
    "guts-dashboard": "workspace:*",
    "jsonschema": "^1.4.1",
    "lucide-react": "^0.279.0",
    "next-themes": "^0.2.1",
    "pdfjs-dist": "^3.8.162",
    "query-string": "^8.1.0",
    "ramda": "^0.29.0",
    "react": "^18.2.0",
    "react-audio-player": "^0.17.0",
    "react-code-mirror": "^4.1.1",
    "react-dom": "^18.2.0",
    "react-loader-spinner": "^5.3.4",
    "react-papaparse": "^4.1.0",
    "react-redux": "^8.1.1",
    "react-router": "^6.14.1",
    "react-router-dom": "^6.14.1",
    "react-spinners": "^0.13.8",
    "react-syntax-highlighter": "^15.5.0",
    "react-toastify": "^9.1.3",
    "shadcn-ui": "^0.4.1",
    "simplex-noise": "^4.0.1",
    "stack-trace": "^1.0.0-pre2",
    "styled-components": "^6.0.3",
    "tailwind-merge": "^1.14.0",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.6.8",
    "zod": "^3.22.2"
  },
  "devDependencies": {
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "@iconify/icons-clarity": "^1.2.8",
    "@iconify/icons-fluent": "^1.2.26",
    "@iconify/icons-heroicons": "^1.2.10",
    "@iconify/icons-mdi": "^1.2.47",
    "@iconify/react": "^4.1.1",
    "@mui/icons-material": "^5.14.0",
    "@mui/material": "^5.14.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.4.3",
    "@types/jest": "^29.5.3",
    "@types/node": "^20.4.3",
    "@types/ramda": "^0.29.3",
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@types/react-syntax-highlighter": "^15.5.7",
    "@types/stack-trace": "^0.0.30",
    "@typescript-eslint/eslint-plugin": "^6.2.1",
    "@typescript-eslint/parser": "^6.2.1",
    "@vitejs/plugin-react": "^4.0.3",
    "@vitejs/plugin-react-swc": "^3.3.2",
    "@vitest/coverage-v8": "^0.33.0",
    "@vitest/ui": "^0.33.0",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.51.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "gray-matter": "^4.0.3",
    "happy-dom": "^10.5.2",
    "jest": "^29.6.1",
    "postcss": "^8.4.31",
    "prettier": "^3.0.3",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.1.6",
    "vite": "^4.4.7",
    "vitest": "^0.33.0"
  }
}
---
