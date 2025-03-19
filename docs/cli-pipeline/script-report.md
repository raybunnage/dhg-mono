# Shell Script Report

Generated: Tue Mar 18 23:18:43 PDT 2025

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

- **Total shell scripts:**       71
- **Executable scripts:**       65
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
  - 📜 [apply_execute_sql_rpc.sh](/scripts/apply_execute_sql_rpc.sh) - ✅ Executable - 2025-03-17 17:58 (3503 bytes)
    - Shebang: `#!/bin/bash`
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
  - 📜 [migrate-cli-scripts.sh](/scripts/migrate-cli-scripts.sh) - ❌ Not executable - 2025-03-17 17:22 (527 bytes)
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
    - 📜 [display-doc-paths.sh](/scripts/cli-pipeline/display-doc-paths.sh) - ✅ Executable - 2025-03-18 20:53 (1782 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [document-manager.sh](/scripts/cli-pipeline/document-manager.sh) - ✅ Executable - 2025-03-18 21:53 (2629 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [document-pipeline-main.sh](/scripts/cli-pipeline/document-pipeline-main.sh) - ✅ Executable - 2025-03-18 23:12 (15326 bytes)
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
    - 📜 [prompt-lookup.sh](/scripts/cli-pipeline/prompt-lookup.sh) - ✅ Executable - 2025-03-17 07:40 (1601 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [run-ai-analyze.sh](/scripts/cli-pipeline/run-ai-analyze.sh) - ✅ Executable - 2025-03-16 18:48 (4152 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [script-report.sh](/scripts/cli-pipeline/script-report.sh) - ✅ Executable - 2025-03-18 23:13 (12342 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [setup-prompts.sh](/scripts/cli-pipeline/setup-prompts.sh) - ✅ Executable - 2025-03-16 12:49 (1 bytes)
      - Shebang: `No shebang`
    - 📜 [show-doc-paths-enhanced.sh](/scripts/cli-pipeline/show-doc-paths-enhanced.sh) - ✅ Executable - 2025-03-18 21:06 (395 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [show-doc-paths-simple.sh](/scripts/cli-pipeline/show-doc-paths-simple.sh) - ✅ Executable - 2025-03-18 21:15 (556 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [show-doc-paths.sh](/scripts/cli-pipeline/show-doc-paths.sh) - ✅ Executable - 2025-03-18 20:53 (2039 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [sync-markdown-files.sh](/scripts/cli-pipeline/sync-markdown-files.sh) - ✅ Executable - 2025-03-17 18:54 (2254 bytes)
      - Shebang: `#!/bin/bash`
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
