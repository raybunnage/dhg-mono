# Shell Script Report

Generated: Fri Mar 14 20:06:59 PDT 2025

## Overview

This report shows all shell script files (.sh) found in the repository, organized hierarchically by directory.
It includes information about each script's executable status, size, and last modification date.

## Summary

- **Total shell scripts:**       55
- **Executable scripts:**       51
- **Non-executable scripts:**        4
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
  - 📜 [script-report.sh](/scripts/script-report.sh) - ✅ Executable - 2025-03-14 20:06 (10820 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [set-permissions.sh](/scripts/set-permissions.sh) - ✅ Executable - 2025-02-22 20:59 (601 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [setup-prompts.sh](/scripts/setup-prompts.sh) - ✅ Executable - 2025-02-21 21:37 (1 bytes)
    - Shebang: `No shebang`
  - 📜 [simple-db-query.sh](/scripts/simple-db-query.sh) - ❌ Not executable - 2025-03-09 15:09 (1 bytes)
    - Shebang: `No shebang`
    - To make executable: `chmod +x scripts/simple-db-query.sh`
  - 📜 [track.sh](/scripts/track.sh) - ✅ Executable - 2025-03-02 11:13 (1192 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [update-docs-database.sh](/scripts/update-docs-database.sh) - ✅ Executable - 2025-03-09 15:09 (26515 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [validate-ai-assets.sh](/scripts/validate-ai-assets.sh) - ✅ Executable - 2025-03-09 17:41 (15392 bytes)
    - Shebang: `#!/bin/bash`
  - 📜 [validate-prompt-relationships.sh](/scripts/validate-prompt-relationships.sh) - ✅ Executable - 2025-03-10 16:14 (27434 bytes)
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
    - 📜 [archive-expert-components.sh](/apps/dhg-improve-experts/archive-expert-components.sh) - ✅ Executable - 2025-02-28 19:23 (2109 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [dev-start.sh](/apps/dhg-improve-experts/dev-start.sh) - ✅ Executable - 2025-03-08 10:29 (725 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [process-docs-batch.sh](/apps/dhg-improve-experts/process-docs-batch.sh) - ✅ Executable - 2025-03-14 10:20 (3410 bytes)
      - Shebang: `#!/bin/bash`
    - 📜 [remove_user_references_code.sh](/apps/dhg-improve-experts/remove_user_references_code.sh) - ✅ Executable - 2025-02-28 13:59 (6361 bytes)
      - Shebang: `No shebang`
    - 📜 [run_investigate_sync.sh](/apps/dhg-improve-experts/run_investigate_sync.sh) - ❌ Not executable - 2025-03-01 15:32 (2149 bytes)
      - Shebang: `#!/bin/bash`
      - To make executable: `chmod +x apps/dhg-improve-experts/run_investigate_sync.sh`
    - 📜 [start-markdown-server.sh](/apps/dhg-improve-experts/start-markdown-server.sh) - ✅ Executable - 2025-03-07 00:47 (618 bytes)
      - Shebang: `#!/bin/bash`
    - 📁 **scripts/**
      - 📜 [classify-markdowns.sh](/apps/dhg-improve-experts/scripts/classify-markdowns.sh) - ✅ Executable - 2025-03-10 21:17 (743 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [examine-markdown.sh](/apps/dhg-improve-experts/scripts/examine-markdown.sh) - ✅ Executable - 2025-03-11 06:22 (904 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [generate-report-and-sync-db.sh](/apps/dhg-improve-experts/scripts/generate-report-and-sync-db.sh) - ✅ Executable - 2025-03-07 00:36 (1554 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [markdown-report.sh](/apps/dhg-improve-experts/scripts/markdown-report.sh) - ✅ Executable - 2025-03-07 00:36 (6204 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [run-docs-processor.sh](/apps/dhg-improve-experts/scripts/run-docs-processor.sh) - ✅ Executable - 2025-03-02 16:23 (648 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [run-workflow.sh](/apps/dhg-improve-experts/scripts/run-workflow.sh) - ✅ Executable - 2025-03-11 06:57 (3222 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [setup_whisper.sh](/apps/dhg-improve-experts/scripts/setup_whisper.sh) - ✅ Executable - 2025-02-22 17:21 (586 bytes)
        - Shebang: `#!/bin/bash`
      - 📜 [update-docs-database.sh](/apps/dhg-improve-experts/scripts/update-docs-database.sh) - ✅ Executable - 2025-03-11 20:32 (12733 bytes)
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
