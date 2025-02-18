## 3689a2a
**Date:** 2025-02-17 14:07:44 -0800
**Message:** okay - fix for the create date and the git info

**Files Changed:**



 .../dhg-improve-experts/src/routes/RegistryViewer.tsx | 19 +++++++++++++++----
 1 file changed, 15 insertions(+), 4 deletions(-)

## 23ea549
**Date:** 2025-02-17 14:04:19 -0800
**Message:** added the date and git fields to registry

**Files Changed:**



 .../dhg-improve-experts/src/routes/RegistryViewer.tsx | 19 +++++++++++++++++++
 1 file changed, 19 insertions(+)

## 6f3390b
**Date:** 2025-02-17 14:00:15 -0800
**Message:** updated types

**Files Changed:**



 supabase/types.ts | 123 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 123 insertions(+)

## a480d88
**Date:** 2025-02-17 13:53:00 -0800
**Message:** archived registry function

**Files Changed:**



 _archive/2025-02-17/RegistryViewer.2025-02-17.tsx  | 141 ++++++++++++++++
 .../create_function_registry.2025-02-17.sql        | 185 +++++++++++++++++++++
 .../function_registry_view.2025-02-17.sql          |   0
 3 files changed, 326 insertions(+)

## 00baa58
**Date:** 2025-02-17 13:45:11 -0800
**Message:** why double commit

**Files Changed:**



 package.json            | 1 +
 scripts/get-git-info.sh | 0
 2 files changed, 1 insertion(+)

## ab412fe
**Date:** 2025-02-17 13:45:03 -0800
**Message:** added gitinfo sceript for adding to the insert statements

**Files Changed:**



 scripts/get-git-info.sh | 17 +++++++++++++++++
 1 file changed, 17 insertions(+)

## d3f37c4
**Date:** 2025-02-17 13:41:14 -0800
**Message:** working reverted history view

**Files Changed:**



 apps/dhg-improve-experts/src/lib/supabase.ts           | 11 ++++++++++-
 apps/dhg-improve-experts/src/routes/RegistryViewer.tsx |  9 ++++++++-
 package.json                                           |  6 +++---
 3 files changed, 21 insertions(+), 5 deletions(-)

## 8fa41c9
**Date:** 2025-02-17 13:25:29 -0800
**Message:** the registry is working I see things now and I got the latest types again

**Files Changed:**



 supabase/types.ts | 124 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 124 insertions(+)

## 78124c6
**Date:** 2025-02-17 12:53:30 -0800
**Message:** don't know why they aren't being recorded

**Files Changed:**



 .gitignore                                         |    4 +
 apps/dhg-improve-experts/package.json              |    4 +-
 apps/dhg-improve-experts/src/App.tsx               |    8 +-
 .../src/components/ExtractContentButton.tsx        |   10 +-
 .../src/components/Navigation.tsx                  |    6 +
 apps/dhg-improve-experts/src/lib/supabase.ts       |   10 +
 .../src/routes/RegistryViewer.tsx                  |  134 ++
 apps/dhg-improve-experts/supabase/types.ts         |    0
 pnpm-lock.yaml                                     |   20 +-
 scripts/generate-types.ts                          |   28 +
 scripts/get-types.ts                               |   31 +
 .../20250217183008_create_function_registry.sql    |  186 ++-
 supabase/types.ts                                  | 1767 ++++++++++++++++++++
 tsconfig.json                                      |   16 +
 14 files changed, 2215 insertions(+), 9 deletions(-)

## ceb08d3
**Date:** 2025-02-17 12:53:11 -0800
**Message:** checkin of changes midway

**Files Changed:**



 package.json      |    3 +-
 supabase/types.ts | 1557 -----------------------------------------------------
 2 files changed, 2 insertions(+), 1558 deletions(-)

## 62aae8f
**Date:** 2025-02-17 10:38:30 -0800
**Message:** a lot of changes for the function registry iut looks like

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   5 +-
 apps/dhg-improve-experts/src/App.tsx               |  88 ++++---
 .../src/components/FileViewer.tsx                  |  94 ++++---
 .../src/components/MainNavbar.tsx                  |  26 ++
 .../src/components/SourceButtons.tsx               |  13 +-
 .../src/components/TestPdfViewer.tsx               |  79 ------
 .../src/pages/function-registry.tsx                |   7 +-
 .../dhg-improve-experts/src/utils/ai-processing.ts | 282 ++++++---------------
 .../src/utils/function-registry.ts                 | 117 +++++++--
 apps/dhg-improve-experts/src/utils/pdf-worker.ts   |   4 -
 .../src/utils/registrations/ai-processing.ts       |  36 +++
 .../src/utils/registrations/components.ts          |  11 +
 .../src/utils/registrations/document-processing.ts |  11 +
 .../src/utils/registrations/google-drive.ts        |  11 +
 .../src/utils/registrations/metadata.ts            |  11 +
 .../src/utils/registrations/whisper.ts             |  11 +
 apps/dhg-improve-experts/vite.config.ts            |   6 +-
 pnpm-lock.yaml                                     |  99 +-------
 .../20250217183008_create_function_registry.sql    |   1 +
 .../[timestamp]_create_function_registry.sql       |  91 +++++++
 20 files changed, 502 insertions(+), 501 deletions(-)

## bfa4bb3
**Date:** 2025-02-17 09:08:24 -0800
**Message:** safely stored the filetree in file-explorer

**Files Changed:**



 apps/dhg-improve-experts/.babelrc                  |   5 +
 apps/dhg-improve-experts/src/App.tsx               |  14 +-
 .../src/components/FunctionUsageTooltip.tsx        |  47 +++++++
 apps/dhg-improve-experts/src/components/Navbar.tsx |   6 +
 .../src/components/SourceButtons.tsx               |  18 ++-
 .../src/pages/file-explorer.tsx                    | 110 +++++++++++++++
 .../src/pages/function-registry.tsx                | 137 +++++++++++++++++++
 .../src/utils/function-decorators.ts               |  22 +++
 .../src/utils/function-migration.ts                |  35 +++++
 .../src/utils/function-registry.ts                 |  37 ++++++
 .../src/utils/scan-functions.ts                    | 148 +++++++++++++++++++++
 apps/dhg-improve-experts/tsconfig.json             |   4 +-
 12 files changed, 574 insertions(+), 9 deletions(-)

## 138d1dd
**Date:** 2025-02-17 00:53:41 -0800
**Message:** okay - can now sort of handle doc fies.

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   1 +
 .../src/components/FileViewer.tsx                  |  56 +++++-
 pnpm-lock.yaml                                     | 205 +++++++++++++++++++++
 3 files changed, 257 insertions(+), 5 deletions(-)

## 21aa00c
**Date:** 2025-02-17 00:34:54 -0800
**Message:** Working .docx viewer now!

**Files Changed:**



 .../src/components/FileViewer.tsx                  | 75 ++++++++++++++--------
 1 file changed, 50 insertions(+), 25 deletions(-)

## 3806ecc
**Date:** 2025-02-17 00:28:41 -0800
**Message:** test extract is working

**Files Changed:**



 apps/dhg-improve-experts/src/App.tsx               |  14 +-
 .../src/pages/ExpertProfiles.tsx                   | 107 +++++----
 .../src/pages/source-buttons.tsx                   | 262 +++++++++++++++++++++
 .../src/pages/source-management.tsx                |  26 ++
 .../dhg-improve-experts/src/utils/metadata-sync.ts | 211 +++++++++++------
 5 files changed, 497 insertions(+), 123 deletions(-)

## 28d42b9
**Date:** 2025-02-16 23:51:54 -0800
**Message:** god so many changes - but our viewewr isn't working right yet

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   5 +-
 apps/dhg-improve-experts/public/pdf.worker.min.js  |   1 +
 apps/dhg-improve-experts/src/App.tsx               |  20 +-
 apps/dhg-improve-experts/src/api/proxy.ts          |  16 +
 .../src/components/DocumentActions.tsx             |  10 +-
 .../src/components/ExtractContentButton.tsx        |   6 +-
 .../src/components/FileTree.tsx                    |  86 +++-
 .../src/components/FileViewer.tsx                  | 529 +++++++++++++++++++++
 .../src/components/GetContentButton.tsx            |   6 +-
 .../src/components/TestPdfViewer.tsx               |  79 +++
 .../src/pages/ExpertProfiles.tsx                   |  88 +++-
 .../src/pages/source-buttons-test.tsx              |  32 ++
 apps/dhg-improve-experts/src/types/supabase.ts     |  62 +++
 .../src/utils/audio-extractor.ts                   |  16 +
 .../src/utils/batch-processor.ts                   |  13 +
 apps/dhg-improve-experts/src/utils/format.ts       |  16 +
 apps/dhg-improve-experts/src/utils/google-drive.ts | 101 +---
 apps/dhg-improve-experts/src/utils/pdf-worker.ts   |   4 +
 .../src/utils/whisper-processing.ts                | 107 +++++
 apps/dhg-improve-experts/vite.config.js            |   4 +
 apps/dhg-improve-experts/vite.config.ts            |   4 +
 pnpm-lock.yaml                                     | 175 ++++---
 supabase/types.ts                                  |  52 ++
 23 files changed, 1229 insertions(+), 203 deletions(-)

## 21336bd
**Date:** 2025-02-16 15:12:36 -0800
**Message:** the pills are working right now for all

**Files Changed:**



 .../src/components/FileTree.tsx                    | 163 ++++++++++-----------
 1 file changed, 81 insertions(+), 82 deletions(-)

## f4cff75
**Date:** 2025-02-16 15:07:25 -0800
**Message:** yes, this is very good.  You are thinking ahead about queing and processing which I will be doing a lot, so this is good preparation for that work.

**Files Changed:**



 .../src/components/FileTree.tsx                    | 63 +++++-----------------
 1 file changed, 12 insertions(+), 51 deletions(-)

## cd33957
**Date:** 2025-02-16 14:56:53 -0800
**Message:** pill work to filter the tree - is amazing actually

**Files Changed:**



 .../src/components/FileTree.tsx                    | 257 ++++++++++++++++++---
 1 file changed, 224 insertions(+), 33 deletions(-)

## dc44f39
**Date:** 2025-02-16 14:27:01 -0800
**Message:** archived expert folder analysis

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        | 349 ---------------------
 .../_archive/ExpertFolderAnalysis.2025-02-16.tsx   |   5 +
 2 files changed, 5 insertions(+), 349 deletions(-)

## df3da99
**Date:** 2025-02-16 14:25:48 -0800
**Message:** changes tp get the filetree to show

**Files Changed:**



 .cursorrules                                       |  32 ++
 .../src/app/experts/profiler/page.tsx              |  16 +-
 .../src/components/ExpertFolderAnalysis.tsx        |  76 +++-
 .../src/components/ExpertProfileExtractor.tsx      |   3 +-
 .../src/components/FileTree.tsx                    |   2 +-
 .../_archive/ExpertFolderAnalysis.2025-02-16.tsx   | 349 ++++++++++++++++++
 .../components/_archive/FileTree.2025-02-16.tsx    | 393 +++++++++++++++++++++
 .../src/pages/ExpertProfiles.tsx                   |  45 ++-
 8 files changed, 884 insertions(+), 32 deletions(-)

## 9473d13
**Date:** 2025-02-16 13:29:41 -0800
**Message:** new tree files for script for tree

**Files Changed:**



 .cursorrules                                       | 44 +++++++++++++
 .../src/app/experts/profiler/page.tsx              | 26 +-------
 docs/development/file-management.md                | 43 +++++++++++++
 package.json                                       |  6 +-
 scripts/check-duplicates.ts                        |  2 +
 scripts/show-tree.js                               | 72 ++++++++++++++++++++++
 6 files changed, 168 insertions(+), 25 deletions(-)

## 0fa5705
**Date:** 2025-02-16 13:17:30 -0800
**Message:** added cursor rules for vite and for the cursor model

**Files Changed:**



 .cursorrules                                       | 22 ++++++++++++++++++++++
 apps/dhg-improve-experts/src/App.tsx               |  2 +-
 .../src/app/experts/profiler/page.tsx              |  4 ++--
 .../dhg-improve-experts/src/utils/ai-processing.ts |  4 +++-
 4 files changed, 28 insertions(+), 4 deletions(-)

## 43f3332
**Date:** 2025-02-16 13:10:57 -0800
**Message:** archived versions of expert profiles

**Files Changed:**



 apps/dhg-improve-experts/.gitignore                |   3 +
 .../src/components/ExpertProfileExtractor.tsx      | 135 ++++++++++++++++++++-
 .../src/pages/expert-profiler.tsx                  |  59 ---------
 3 files changed, 134 insertions(+), 63 deletions(-)

## 048d831
**Date:** 2025-02-16 11:43:38 -0800
**Message:** major checkin of reworked experts_profile with a better prompt:

**Files Changed:**



 .../docs/prompts/expert-extraction-prompt.md       |  49 ++
 .../src/app/experts/profiler/page.tsx              |  44 ++
 .../src/app/experts/profiler/prompts.ts            | 136 ++++++
 .../src/components/ExpertProfileExtractor.tsx      | 496 +++++++++++++--------
 .../src/components/ProcessingControls.tsx          | 134 ++++++
 apps/dhg-improve-experts/src/config/ai-prompts.ts  |  55 +++
 .../dhg-improve-experts/src/utils/ai-processing.ts |  34 +-
 .../src/utils/document-processing.ts               | 306 +++++++++----
 .../dhg-improve-experts/src/utils/prompt-loader.ts |  22 +-
 docs/guides/batch-processing-and-trees.md          | 279 ++++++++++++
 docs/guides/file-entries-mapping.md                | 180 ++++++++
 docs/guides/using-supabase-views.md                | 209 +++++++++
 docs/troubleshooting/component-integration.md      | 107 +++++
 13 files changed, 1736 insertions(+), 315 deletions(-)

## 6d93bf8
**Date:** 2025-02-16 09:52:03 -0800
**Message:** rearrange the documentation to understand what we have

**Files Changed:**



 .../src/components/FileList.tsx                    |   74 +
 .../src/components/FileTree.tsx                    |   76 +-
 .../src/components/FileTreeItem.tsx                |  136 ++
 .../src/components/SourceButtons.tsx               |   84 ++
 .../src/pages/expert-profiler.tsx                  |   30 +
 .../src/utils/google-drive-sync.ts                 |  133 ++
 .../dhg-improve-experts/src/utils/metadata-sync.ts |   92 ++
 docs/components/SourceButtons.md                   |  313 ++++
 docs/project-structure/supabase_types.md           |   83 ++
 docs/utils/ai-processing.md                        |  263 ++++
 docs/utils/google-drive.md                         |  293 ++++
 docs/utils/sync-file-metadata.md                   |  194 +++
 .../20250216031157_create_presentations.sql        |    0
 .../[timestamp]_create_presentations.sql           |   46 +
 supabase/types.ts                                  | 1505 ++++++++++++++++++++
 15 files changed, 3316 insertions(+), 6 deletions(-)

## 17d3d56
**Date:** 2025-02-15 16:34:18 -0800
**Message:** cards are working now

**Files Changed:**



 .../src/components/ExpertProfileExtractor.tsx      |  58 +++--
 .../src/components/ProcessedProfileViewer.tsx      | 265 +++++++++++++++++++++
 2 files changed, 304 insertions(+), 19 deletions(-)

## 14ab240
**Date:** 2025-02-15 16:11:55 -0800
**Message:** you have all the processed_)content stored away

**Files Changed:**



 .../src/components/ExpertProfileExtractor.tsx      | 159 ++++++++++++++++++++-
 1 file changed, 158 insertions(+), 1 deletion(-)

## 460f46d
**Date:** 2025-02-15 15:58:27 -0800
**Message:** now working profiles - on the fly seems to work

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   1 +
 apps/dhg-improve-experts/src/App.tsx               |  33 ++-
 .../src/components/ExpertProfileExtractor.tsx      | 264 +++++++++++++++++++++
 apps/dhg-improve-experts/src/pages/Experts.tsx     |  20 +-
 .../src/pages/expert-profiler.tsx                  |  29 +++
 .../dhg-improve-experts/src/utils/ai-processing.ts | 110 +++++++++
 .../dhg-improve-experts/src/utils/prompt-loader.ts |  13 +
 docs/prompts/expert-extraction-prompt.md           |  49 ++++
 docs/prompts/expert-profiles.md                    |  33 +++
 pnpm-lock.yaml                                     |  73 ++++++
 10 files changed, 614 insertions(+), 11 deletions(-)

## 7b7b684
**Date:** 2025-02-15 13:45:07 -0800
**Message:** now we have the extracted info

**Files Changed:**



 .../src/components/ExtractContentButton.tsx        |   2 +-
 .../src/components/ExtractedContentViewer.tsx      | 180 ++++++++-------------
 .../src/pages/document-testing.tsx                 |  37 ++---
 3 files changed, 76 insertions(+), 143 deletions(-)

## fe69fc3
**Date:** 2025-02-15 13:40:52 -0800
**Message:** now the extraction seems to beworkking

**Files Changed:**



 .../src/components/DocumentActions.tsx             |   59 +-
 .../src/components/ExtractContentButton.tsx        |  415 ++++++
 .../src/components/ExtractedContentViewer.tsx      |  158 +++
 .../src/components/GetContentButton.tsx            |  102 +-
 .../src/integrations/supabase/client.ts            |   15 +-
 .../src/pages/document-testing.tsx                 |   55 +-
 apps/dhg-improve-experts/src/types/supabase.ts     | 1460 +++++++++++++++++++-
 apps/dhg-improve-experts/src/utils/google-drive.ts |  108 +-
 8 files changed, 2266 insertions(+), 106 deletions(-)

## a339927
**Date:** 2025-02-15 12:25:37 -0800
**Message:** changes for document-testing

**Files Changed:**



 apps/dhg-improve-experts/src/App.tsx               |  2 ++
 apps/dhg-improve-experts/src/components/index.ts   |  3 ++
 .../src/pages/document-testing.tsx                 | 28 ++++++++++++++++
 .../src/pages/documents/index.tsx                  | 14 ++++++++
 apps/dhg-improve-experts/src/types/supabase.ts     | 39 ++++++++++++++++++++++
 .../dhg-improve-experts/src/utils/ai-processing.ts | 16 ++-------
 6 files changed, 89 insertions(+), 13 deletions(-)

## afbaa17
**Date:** 2025-02-15 12:03:46 -0800
**Message:** build testing of content extraction

**Files Changed:**



 .../src/components/DocumentActions.tsx             |  56 ++++
 .../src/components/ExtractButton.tsx               |  59 ++++
 .../src/components/GetContentButton.tsx            | 177 ++++++++++++
 .../dhg-improve-experts/src/utils/ai-processing.ts | 300 ++++++++++++++++-----
 4 files changed, 525 insertions(+), 67 deletions(-)

## 55f1bdb
**Date:** 2025-02-15 11:43:09 -0800
**Message:** first changes for the ai test

**Files Changed:**



 .../src/components/SourceButtons.tsx               |  86 ++++++++++++++-
 .../dhg-improve-experts/src/utils/ai-processing.ts | 120 +++++++++++++++++++++
 docs/project-structure/content-extraction_flow.md  |  35 ++++++
 3 files changed, 240 insertions(+), 1 deletion(-)

## 300f146
**Date:** 2025-02-15 09:11:52 -0800
**Message:** added documentation

**Files Changed:**



 docs/project-structure/anatomy-of-a-button.md     | 237 ++++++++++++++++++++++
 docs/project-structure/architecture-comparison.md | 167 +++++++++++++++
 docs/project-structure/shared-packages-guide.md   | 222 ++++++++++++++++++++
 3 files changed, 626 insertions(+)

## c2a5c1e
**Date:** 2025-02-15 08:45:59 -0800
**Message:** added a bunch of documentation

**Files Changed:**



 docs/project-structure/batch-processing.md         |  86 +++
 .../dhg-improve-experts-structure.md               | 854 +++++++++++++++++++++
 docs/project-structure/supabase-functions.md       | 180 +++++
 docs/project-structure/supabase-interactions.md    | 270 +++++++
 4 files changed, 1390 insertions(+)

## 4f5b22c
**Date:** 2025-02-15 07:47:05 -0800
**Message:** added some batch processing views

**Files Changed:**



 .../src/components/BatchManager.tsx                |  70 ++++++++
 .../src/components/BatchProgress.tsx               |  39 +++++
 .../src/components/FileTree.tsx                    | 186 +++++++++++++++++++--
 3 files changed, 279 insertions(+), 16 deletions(-)

## 84d18ba
**Date:** 2025-02-14 18:10:38 -0800
**Message:** descending order works by date now

**Files Changed:**



 .../src/components/FileTree.tsx                    | 134 +++++++++++++++------
 1 file changed, 99 insertions(+), 35 deletions(-)

## f3fbff4
**Date:** 2025-02-14 18:01:51 -0800
**Message:** got rid of the files at the bottom

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        | 51 +---------------------
 1 file changed, 1 insertion(+), 50 deletions(-)

## 3c2000c
**Date:** 2025-02-14 17:57:01 -0800
**Message:** removed the dcument folders section

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        |  65 ------------
 .../src/components/FileTree.tsx                    | 111 +++++++++++++++++++++
 .../src/components/SourceButtons.tsx               |  88 +++++-----------
 3 files changed, 136 insertions(+), 128 deletions(-)

## 97ff769
**Date:** 2025-02-14 17:14:44 -0800
**Message:** wow - maybe it really captured it right

**Files Changed:**



 apps/dhg-improve-experts/src/utils/google-drive.ts | 62 ++++++++++++++++------
 1 file changed, 47 insertions(+), 15 deletions(-)

## ab79721
**Date:** 2025-02-14 16:35:56 -0800
**Message:** seems sync is working

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        | 510 ++++++++++++++-------
 .../src/components/SourceButtons.tsx               | 204 +++++----
 .../src/pages/ExpertProfiles.tsx                   |   4 +-
 apps/dhg-improve-experts/src/utils/google-drive.ts |  81 ++--
 .../20240211000001_add_deleted_to_sources.sql      |  12 +
 ...14235341_add_path_columns_to_sources_google.sql |   0
 ...mestamp]_add_path_columns_to_sources_google.sql |   7 +
 .../[timestamp]_fix_path_column_type.sql           |  11 +
 8 files changed, 530 insertions(+), 299 deletions(-)

## af25ec0
**Date:** 2025-02-14 08:08:57 -0800
**Message:** changes that really sync sources_google

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        |  61 +++-
 .../src/components/SourceButtons.tsx               | 388 ++++++++++++++++++---
 .../src/pages/ExpertProfiles.tsx                   |  63 +---
 .../src/utils/document-processing.ts               |  47 ++-
 apps/dhg-improve-experts/src/utils/google-drive.ts |  81 +++++
 docs/migrations/api-drive-supa.md                  |  72 +++-
 supabase/functions/sync-google-sources/index.ts    |  63 +++-
 7 files changed, 645 insertions(+), 130 deletions(-)

## 8057181
**Date:** 2025-02-13 22:55:17 -0800
**Message:** doing something, not quite sure what

**Files Changed:**



 .../src/utils/document-processing.ts               | 45 ++++++++++++++++++++--
 docs/migrations/api-drive-supa.md                  | 38 ++++++++++++++++++
 2 files changed, 79 insertions(+), 4 deletions(-)

## bac5968
**Date:** 2025-02-13 22:48:02 -0800
**Message:** some rudimentary documentation

**Files Changed:**



 docs/migrations/api-drive-supa.md | 107 ++++++++++++++++++++++++++++++++++++++
 1 file changed, 107 insertions(+)

## 41d369d
**Date:** 2025-02-13 22:18:26 -0800
**Message:** seems like its working to extract

**Files Changed:**



 .../src/components/SourceButtons.tsx               | 157 ++++++++++++++++++++-
 .../src/utils/document-processing.ts               |  42 +++++-
 apps/dhg-improve-experts/src/utils/google-drive.ts |  76 ++++++++++
 3 files changed, 273 insertions(+), 2 deletions(-)

## 997a7f4
**Date:** 2025-02-13 21:29:12 -0800
**Message:** works to write to the expert_documents file - with mock data

**Files Changed:**



 .github/workflows/deploy-functions.yml             |  24 +++++
 .../src/components/AuthRequired.tsx                |  17 +++
 .../src/components/SourceButtons.tsx               |  18 +++-
 .../src/integrations/supabase/client.ts            |   8 +-
 .../src/utils/document-processing.ts               | 117 +++++++++++++++++++++
 supabase/functions/extract-source-content/index.ts |  68 +++++++++++-
 6 files changed, 242 insertions(+), 10 deletions(-)

## 1124847
**Date:** 2025-02-13 09:01:19 -0800
**Message:** added some edge functions

**Files Changed:**



 .../src/components/SourceButtons.tsx               | 54 ++++++++++++++++++++++
 .../src/components/SourcesView.tsx                 |  7 ++-
 apps/dhg-improve-experts/supabase/.temp/cli-latest |  2 +-
 .../functions/extract-source-content/deno.json     |  3 ++
 .../functions/extract-source-content/index.ts      | 32 +++++++++++++
 .../functions/sync-google-sources/deno.json        |  3 ++
 .../functions/sync-google-sources/index.ts         | 32 +++++++++++++
 supabase/functions/extract-source-content/index.ts | 18 ++++++++
 supabase/functions/sync-google-sources/index.ts    | 18 ++++++++
 9 files changed, 167 insertions(+), 2 deletions(-)

## 3aaa784
**Date:** 2025-02-13 08:57:48 -0800
**Message:** added react hot toast

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   1 +
 apps/dhg-improve-experts/src/App.tsx               |   2 +
 .../src/components/ExpertProfiles.tsx              |  42 ----
 .../src/components/SourcesView.tsx                 | 101 ++++-----
 .../src/pages/ExpertProfiles.tsx                   | 229 +++------------------
 pnpm-lock.yaml                                     |  26 +++
 6 files changed, 108 insertions(+), 293 deletions(-)

## 1245e70
**Date:** 2025-02-13 08:36:27 -0800
**Message:** changes for searching

**Files Changed:**



 .../src/components/SourcesView.tsx                 | 71 ++++++++++++++++++++--
 1 file changed, 67 insertions(+), 4 deletions(-)

## ccbd339
**Date:** 2025-02-13 07:35:11 -0800
**Message:** going for all sources_google files

**Files Changed:**



 apps/dhg-improve-experts/src/components/ExpertProfiles.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

## 43c5e8c
**Date:** 2025-02-13 07:34:38 -0800
**Message:** going for all files now

**Files Changed:**



 .../src/integrations/google-drive.ts               | 99 +++++++++++++---------
 1 file changed, 57 insertions(+), 42 deletions(-)

## 1a20176
**Date:** 2025-02-13 07:32:36 -0800
**Message:** amazingly its working

**Files Changed:**



 .../src/components/ExpertProfiles.tsx              |  21 +--
 .../src/components/SourcesView.tsx                 | 151 +++++++++++++++++++++
 2 files changed, 164 insertions(+), 8 deletions(-)

## ecb8888
**Date:** 2025-02-13 07:29:17 -0800
**Message:** worked for 100 records

**Files Changed:**



 .../src/components/ExpertProfiles.tsx              | 37 ++++++++++++
 .../src/integrations/google-drive.ts               | 69 +++++++++++++++++++++-
 2 files changed, 104 insertions(+), 2 deletions(-)

## a344036
**Date:** 2025-02-13 07:19:42 -0800
**Message:** updating documentation

**Files Changed:**



 .../src/integrations/google-drive.ts               | 28 ++++++++++++++++++++
 apps/dhg-improve-experts/src/utils/google-auth.ts  | 30 ++++++++++++++++++++++
 docs/migrations/migration_management.md            | 23 +++++++++++++++++
 3 files changed, 81 insertions(+)

## 9a84cae
**Date:** 2025-02-13 06:57:36 -0800
**Message:** updatiung the migration documents and making a table of the objects used in in the hybrid approach

**Files Changed:**



 .../{concepts => deployment}/what-is-deployment.md |   0
 docs/migrations/table-structure.md                 | 215 +++++++++++++++++++++
 docs/project-structure/pnpm-commands.md            |  79 ++++++++
 3 files changed, 294 insertions(+)

## 09dae33
**Date:** 2025-02-13 06:48:01 -0800
**Message:** one more

**Files Changed:**



 .../applied_in_sql_editor_for_hybrid.sql           | 197 +++++++++++++++++++++
 1 file changed, 197 insertions(+)

## 485437f
**Date:** 2025-02-13 06:46:43 -0800
**Message:** checking in scripts that didn't quite work as migrations

**Files Changed:**



 .cursorrules                                       |  66 +++++++++++++
 custom_instructions                                |  38 --------
 custom_instructions.json                           |  52 -----------
 .../20250210015657_create_sources_google.sql       | 103 +++++++++++++++++++++
 .../20250210020656_create_sources_google_down.sql  |   0
 ...70027_created_update_by_document_types.down.sql |  48 ++++++++++
 ...0213070027_created_update_by_document_types.sql |  48 ++++++++++
 ...250213080000_update_experts_for_hybrid.down.sql |  22 +++++
 .../20250213080000_update_experts_for_hybrid.sql   |  25 +++++
 ...80001_update_sources_google_for_hybrid.down.sql |  23 +++++
 ...0213080001_update_sources_google_for_hybrid.sql |  25 +++++
 ...50213081725_update_source_google_for_hybrid.sql |  25 +++++
 ...20250213081726_create_expert_documents.down.sql |  24 +++++
 .../20250213081726_create_expert_documents.sql     |   0
 .../20250213082726_update_expert_documents.sql     |  27 ++++++
 .../20250213082727_fix_document_types_naming.sql   |   7 ++
 16 files changed, 443 insertions(+), 90 deletions(-)

## 6e51283
**Date:** 2025-02-13 00:22:07 -0800
**Message:** removing the migrations as we go

**Files Changed:**



 ...50213081725_update_source_google_for_hybrid.sql | 25 ----------------------
 1 file changed, 25 deletions(-)

## ebfb295
**Date:** 2025-02-13 00:19:31 -0800
**Message:** updating and adding one up migration

**Files Changed:**



 docs/migrations/migration_management.md            | 48 +++++++++++++++++++++-
 ...250213080000_update_experts_for_hybrid.down.sql | 22 ----------
 .../20250213080000_update_experts_for_hybrid.sql   |  1 -
 ...50213081725_update_source_google_for_hybrid.sql | 25 +++++++++++
 4 files changed, 71 insertions(+), 25 deletions(-)

## d90076f
**Date:** 2025-02-12 23:58:28 -0800
**Message:** check in the changes

**Files Changed:**



 docs/migrations/migration_management.md            | 153 ++++++++++-----------
 docs/migrations/migrations.md                      | 144 -------------------
 .../20250210015657_create_sources_google.sql       | 103 --------------
 .../20250210020656_create_sources_google_down.sql  |   0
 ...70027_created_update_by_document_types.down.sql |  48 -------
 ...0213070027_created_update_by_document_types.sql |  48 -------
 ...250213080000_update_experts_for_hybrid.down.sql |  22 +++
 .../20250213080000_update_experts_for_hybrid.sql   |   1 +
 8 files changed, 92 insertions(+), 427 deletions(-)

## ada2263
**Date:** 2025-02-12 23:12:59 -0800
**Message:** added new pair of migrations

**Files Changed:**



 ...11132_rename_and_modify_document_types.down.sql | 90 ----------------------
 ...0213011132_rename_and_modify_document_types.sql | 88 ---------------------
 ...70027_created_update_by_document_types.down.sql | 48 ++++++++++++
 ...0213070027_created_update_by_document_types.sql | 48 ++++++++++++
 4 files changed, 96 insertions(+), 178 deletions(-)

## 1a0961b
**Date:** 2025-02-12 21:29:52 -0800
**Message:** the problem was in the package json that was calling the supabase client rather than oiur repair script

**Files Changed:**



 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

## 508b964
**Date:** 2025-02-12 21:02:54 -0800
**Message:** may have really fixed it this time

**Files Changed:**



 scripts/supabase/run-migration.sh | 27 ++++++++++++++++++++++++---
 1 file changed, 24 insertions(+), 3 deletions(-)

## 74e2cbc
**Date:** 2025-02-12 20:54:41 -0800
**Message:** supposedly fixed

**Files Changed:**



 scripts/supabase/run-migration.sh | 7 -------
 1 file changed, 7 deletions(-)

## 3b3b927
**Date:** 2025-02-12 20:52:50 -0800
**Message:** script changed AGAIN

**Files Changed:**



 scripts/supabase/run-migration.sh | 17 ++++++++++++++---
 1 file changed, 14 insertions(+), 3 deletions(-)

## 28d5125
**Date:** 2025-02-12 20:46:10 -0800
**Message:** fixed the script

**Files Changed:**



 scripts/supabase/run-migration.sh | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

## 56aacee
**Date:** 2025-02-12 20:43:11 -0800
**Message:** TRYING echo for y this tikme

**Files Changed:**



 scripts/supabase/run-migration.sh | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)

## cd6ef0e
**Date:** 2025-02-12 20:40:59 -0800
**Message:** fixing y to run automatically

**Files Changed:**



 scripts/supabase/run-migration.sh | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

## c0bc221
**Date:** 2025-02-12 20:37:25 -0800
**Message:** more debugging for getting truncate working

**Files Changed:**



 scripts/supabase/run-migration.sh | 12 ++++++++++++
 1 file changed, 12 insertions(+)

## e07059d
**Date:** 2025-02-12 20:34:06 -0800
**Message:** fixing repair again

**Files Changed:**



 scripts/supabase/run-migration.sh | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)

## 91e19bf
**Date:** 2025-02-12 20:31:27 -0800
**Message:** fixing the pnpm repair

**Files Changed:**



 package.json                      |  2 +-
 scripts/supabase/run-migration.sh | 13 ++++++++++++-
 2 files changed, 13 insertions(+), 2 deletions(-)

## 0979617
**Date:** 2025-02-12 20:15:25 -0800
**Message:** fixing create screipt and renaming down file

**Files Changed:**



 scripts/create-migration.sh                                             | 2 +-
 ...own.sql => 20250213011132_rename_and_modify_document_types.down.sql} | 0
 2 files changed, 1 insertion(+), 1 deletion(-)

## 1f66e82
**Date:** 2025-02-12 20:11:49 -0800
**Message:** updating to latest supabase client

**Files Changed:**



 package.json   |  2 +-
 pnpm-lock.yaml | 34 ++++++++++++++++++++++------------
 2 files changed, 23 insertions(+), 13 deletions(-)

## 77b02e7
**Date:** 2025-02-12 19:50:48 -0800
**Message:** working on the migration scripts

**Files Changed:**



 package.json                                       |  3 +-
 ...0213011132_rename_and_modify_document_types.sql | 43 ++------------------
 ...11132_rename_and_modify_document_types_down.sql | 46 +++-------------------
 3 files changed, 10 insertions(+), 82 deletions(-)

## 6b7f5cc
**Date:** 2025-02-12 19:34:00 -0800
**Message:** simplified backup

**Files Changed:**



 .../20250213011132_rename_and_modify_document_types.sql  | 16 ++--------------
 ...50213011132_rename_and_modify_document_types_down.sql | 13 +++----------
 2 files changed, 5 insertions(+), 24 deletions(-)

## a677fda
**Date:** 2025-02-12 19:31:17 -0800
**Message:** got rid of slug

**Files Changed:**



 .../migrations/20250213011132_rename_and_modify_document_types.sql    | 4 +---
 1 file changed, 1 insertion(+), 3 deletions(-)

## 685658a
**Date:** 2025-02-12 19:29:04 -0800
**Message:** add psql command and looked for more fields to get rid of domain_id

**Files Changed:**



 package.json                                       |  5 +-
 scripts/supabase/start-psql.sh                     | 42 ++++++++++
 ...0213011132_rename_and_modify_document_types.sql | 95 +++++++++++++++++++++-
 ...11132_rename_and_modify_document_types_down.sql | 95 +++++++++++++++++++++-
 4 files changed, 231 insertions(+), 6 deletions(-)

## acf3016
**Date:** 2025-02-12 17:27:28 -0800
**Message:** cleaned up the up migration

**Files Changed:**



 .../20250213011132_rename_and_modify_document_types.sql           | 8 ++++++--
 1 file changed, 6 insertions(+), 2 deletions(-)

## a942855
**Date:** 2025-02-12 17:17:14 -0800
**Message:** new files to apply

**Files Changed:**



 ...0213011132_rename_and_modify_document_types.sql | 48 ++++++++++++++++++++++
 ...11132_rename_and_modify_document_types_down.sql | 40 ++++++++++++++++++
 2 files changed, 88 insertions(+)

## f219b20
**Date:** 2025-02-12 17:11:23 -0800
**Message:** chagnes again

**Files Changed:**



 scripts/create-migration.sh | 19 +++++--------------
 1 file changed, 5 insertions(+), 14 deletions(-)

## 694c3b2
**Date:** 2025-02-12 17:04:50 -0800
**Message:** some tweaking of the create scripts to prevent race conditions

**Files Changed:**



 docs/scripting/shell-scripting-basics.md |  9 +++++++++
 scripts/create-migration.sh              | 12 +++++++-----
 2 files changed, 16 insertions(+), 5 deletions(-)

## f7376a4
**Date:** 2025-02-12 14:21:55 -0800
**Message:** getting rid of patterns.txt

**Files Changed:**



 .gitignore                               |   6 +
 docs/scripting/shell-scripting-basics.md | 189 +++++++++++++++++++++++++++++++
 2 files changed, 195 insertions(+)

## 5c417f8
**Date:** 2025-02-12 14:21:35 -0800
**Message:** getting rid of patterns.txt oin git

**Files Changed:**



 patterns.txt | 1 -
 1 file changed, 1 deletion(-)

## a328228
**Date:** 2025-02-12 09:23:48 -0800
**Message:** modifying script screation to prevent duplicates

**Files Changed:**



 scripts/create-migration.sh                        | 80 +++++++++++++++++++---
 ...0212171851_rename_and_modify_document_types.sql |  0
 ...71851_rename_and_modify_document_types_down.sql |  0
 3 files changed, 72 insertions(+), 8 deletions(-)

## ee0e86c
**Date:** 2025-02-12 09:19:00 -0800
**Message:** cleanup again

**Files Changed:**



 ...ment_types.sql => 20250212171851_rename_and_modify_document_types.sql} | 0
 ..._down.sql => 20250212171851_rename_and_modify_document_types_down.sql} | 0
 2 files changed, 0 insertions(+), 0 deletions(-)

## 137e22a
**Date:** 2025-02-12 09:17:16 -0800
**Message:** redoing with a better script

**Files Changed:**



 package.json                                       |  3 +-
 scripts/create-migration.sh                        | 13 +++++++
 ...0211123604_rename_and_modify_document_types.sql |  1 -
 ...23604_rename_and_modify_document_types_down.sql | 40 ----------------------
 ...0212171621_rename_and_modify_document_types.sql |  0
 ...71621_rename_and_modify_document_types_down.sql |  0
 6 files changed, 15 insertions(+), 42 deletions(-)

## a2f0012
**Date:** 2025-02-12 09:07:01 -0800
**Message:** removed dup

**Files Changed:**



 supabase/migrations/20250212170416_rename_and_modify_document_types.sql | 0
 1 file changed, 0 insertions(+), 0 deletions(-)

## 23e07f8
**Date:** 2025-02-12 09:06:21 -0800
**Message:** made the down file

**Files Changed:**



 ...23604_rename_and_modify_document_types_down.sql | 41 +++++++++++++++++++++-
 1 file changed, 40 insertions(+), 1 deletion(-)

## 5b7b546
**Date:** 2025-02-12 09:05:33 -0800
**Message:** up and down file

**Files Changed:**



 supabase/migrations/20250211123604_rename_and_modify_document_types.sql  | 1 +
 .../migrations/20250211123604_rename_and_modify_document_types_down.sql  | 1 +
 supabase/migrations/20250212170416_rename_and_modify_document_types.sql  | 0
 3 files changed, 2 insertions(+)

## 3ff6b7f
**Date:** 2025-02-12 09:03:56 -0800
**Message:** cleaned

**Files Changed:**



 supabase/migrations/20250210215603_add_last_synced_column.sql           | 0
 supabase/migrations/20250210215603_add_last_synced_column_down.sql      | 0
 supabase/migrations/20250212144930_rename_and_modify_document_types.sql | 0
 3 files changed, 0 insertions(+), 0 deletions(-)

## cf41ea9
**Date:** 2025-02-12 09:02:23 -0800
**Message:** more documentatin

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 82 +++++++++++++++++++++++++-
 1 file changed, 81 insertions(+), 1 deletion(-)

## c583402
**Date:** 2025-02-12 06:57:42 -0800
**Message:** another migration file and more docs

**Files Changed:**



 docs/migrations/source_expert_google_design.md     | 25 +++++++++++++++++++++-
 .../20250210215603_add_last_synced_column_down.sql |  0
 2 files changed, 24 insertions(+), 1 deletion(-)

## 41cb1b0
**Date:** 2025-02-12 06:52:39 -0800
**Message:** added to doc

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 16 ++++++++++++++++
 1 file changed, 16 insertions(+)

## d963a5c
**Date:** 2025-02-12 06:49:49 -0800
**Message:** cleanuip and documentation

**Files Changed:**



 docs/migrations/source_expert_google_design.md     | 19 ++++-
 .../20250210215603_add_last_synced_column.sql      |  0
 ...0211123604_rename_and_modify_document_types.sql | 91 ----------------------
 ...23604_rename_and_modify_document_types_down.sql | 72 -----------------
 ...0212144930_rename_and_modify_document_types.sql |  0
 5 files changed, 18 insertions(+), 164 deletions(-)

## 33073fe
**Date:** 2025-02-12 06:47:02 -0800
**Message:** updated migration doc

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 12 ++++++++++++
 1 file changed, 12 insertions(+)

## 7c9572b
**Date:** 2025-02-12 06:45:23 -0800
**Message:** checkin again the new migratin files

**Files Changed:**



 ...0211123604_rename_and_modify_document_types.sql | 91 ++++++++++++++++++++++
 ...23604_rename_and_modify_document_types_down.sql | 72 +++++++++++++++++
 2 files changed, 163 insertions(+)

## 96b179f
**Date:** 2025-02-12 06:36:55 -0800
**Message:** updated docs on migration again

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 71 +++++++++++++++++++++++++-
 1 file changed, 70 insertions(+), 1 deletion(-)

## faa2bb7
**Date:** 2025-02-12 06:34:04 -0800
**Message:** updated migratin docs

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 37 +++++++++++++++++---------
 1 file changed, 25 insertions(+), 12 deletions(-)

## 01caf3e
**Date:** 2025-02-12 06:33:15 -0800
**Message:** updated docs

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 14 ++++++++++++--
 1 file changed, 12 insertions(+), 2 deletions(-)

## 6bd13f3
**Date:** 2025-02-12 06:31:51 -0800
**Message:** cleanup of migrations

**Files Changed:**



 docs/migrations/source_expert_google_design.md     | 21 +++++++---
 .../20250210215604_add_last_synced_column.sql      | 14 -------
 .../20250210215604_add_last_synced_column_down.sql |  7 ----
 ...0211123001_rename_and_modify_document_types.sql | 49 ----------------------
 ...23001_rename_and_modify_document_types_down.sql | 21 ----------
 5 files changed, 16 insertions(+), 96 deletions(-)

## ee7c257
**Date:** 2025-02-12 06:29:51 -0800
**Message:** updated our docjmentation

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 42 +++++++++++++
 supabase/templates/migration.sql               | 86 +++++++++++++++++++++++---
 2 files changed, 121 insertions(+), 7 deletions(-)

## db19c14
**Date:** 2025-02-12 06:27:04 -0800
**Message:** upodated and improved cursore rules

**Files Changed:**



 .cursorrules             | 60 +++++++++++++++++++++++++++++++++++++++++-------
 custom_instructions.json | 52 +++++++++++++++++++++++++++++++++++++++++
 2 files changed, 104 insertions(+), 8 deletions(-)

## 986ba77
**Date:** 2025-02-12 06:18:59 -0800
**Message:** renamed the migratins script for document types

**Files Changed:**



 ...ment_types.sql => 20250211123001_rename_and_modify_document_types.sql} | 0
 ..._down.sql => 20250211123001_rename_and_modify_document_types_down.sql} | 0
 2 files changed, 0 insertions(+), 0 deletions(-)

## bc6bab9
**Date:** 2025-02-12 06:14:59 -0800
**Message:** moved the timestamps to file_types that were migrations in progress

**Files Changed:**



 .../[timestamp]_modify_sources_google_for_hybrid.sql   | 18 ------------------
 ...imestamp]_modify_sources_google_for_hybrid_down.sql | 18 ------------------
 2 files changed, 36 deletions(-)

## 86d94d0
**Date:** 2025-02-12 06:07:59 -0800
**Message:** checkin quit command for postgres

**Files Changed:**



 docs/migrations/source_expert_google_design.md | 4 ++++
 1 file changed, 4 insertions(+)

## b5db71a
**Date:** 2025-02-12 06:02:07 -0800
**Message:** preparing for adding database changes

**Files Changed:**



 docs/migrations/source_expert_google_design.md     | 849 +++++++++++++++++++++
 ...0211123000_rename_and_modify_document_types.sql |  49 ++
 ...23000_rename_and_modify_document_types_down.sql |  21 +
 ...timestamp]_modify_sources_google_for_hybrid.sql |  18 +
 ...tamp]_modify_sources_google_for_hybrid_down.sql |  18 +
 5 files changed, 955 insertions(+)

## b515bd5
**Date:** 2025-02-11 21:16:02 -0800
**Message:** finally works for the ujp and down migration.

**Files Changed:**



 package.json                                       |  1 +
 scripts/supabase/run-migration.sh                  | 41 +++++++++++++++++++++-
 .../20250210215603_add_last_synced_column.down.sql |  9 -----
 .../20250210215604_add_last_synced_column_down.sql |  7 ++++
 4 files changed, 48 insertions(+), 10 deletions(-)

## b6d1e28
**Date:** 2025-02-11 09:11:40 -0800
**Message:** working migration

**Files Changed:**



 .cursorrules                                       | 24 ++++++++++++++++++++++
 package.json                                       |  4 +++-
 patterns.txt                                       |  1 +
 scripts/supabase/run-migration.sh                  |  6 ++++++
 ...20250210215603_add_last_synced_column.down.sql} |  0
 ...l => 20250210215604_add_last_synced_column.sql} |  0
 6 files changed, 34 insertions(+), 1 deletion(-)

## 591a23a
**Date:** 2025-02-11 08:37:25 -0800
**Message:** chore: remove sensitive data from .env.example

**Files Changed:**



 .env.example | 34 ++++------------------------------
 1 file changed, 4 insertions(+), 30 deletions(-)

## 8ba38cd
**Date:** 2025-02-11 08:17:08 -0800
**Message:** redid scripts for migration to match supabase client

**Files Changed:**



 docs/migrations/migration_management.md            | 111 ++++-----------------
 scripts/supabase/run-migration.sh                  |  24 ++++-
 supabase/docs/migration-management.md              |   0
 .../20240321000001_add_last_synced_column_down.sql |   0
 .../20250210015657_create_sources_google.sql       |   0
 .../20250210020656_create_sources_google_down.sql  |   0
 .../20250210215603_add_last_synced_column.sql      |   0
 supabase/scripts/test-migration.sh                 |   0
 supabase/templates/migration.sql                   |  38 +++++++
 supabase/templates/migration_template.sql          |   0
 10 files changed, 81 insertions(+), 92 deletions(-)

## e092d7b
**Date:** 2025-02-10 22:05:06 -0800
**Message:** a bunch of changes to help automate migrations

**Files Changed:**



 .env.example                                       |   8 +-
 .../src/components/ExpertCard.tsx                  | 108 ++++++++++++
 .../src/lib/google-drive/sync.ts                   |  41 +++++
 .../dhg-improve-experts/src/pages/ExpertDetail.tsx |  63 +++++++
 docs/{ => migrations}/google-drive-integration.md  |   0
 docs/migrations/migration_management.md            | 182 +++++++++++++++++++++
 docs/{ => migrations}/migrations.md                |   0
 package.json                                       |   5 +-
 scripts/supabase/complete-migration.sh             |  17 ++
 scripts/supabase/run-migration.sh                  |  22 +++
 .../migration-management.md}                       |   0
 .../20250210015657_create_sources_google.sql       |   0
 .../20250210020656_create_sources_google_down.sql  |   0
 .../20240321000001_add_last_synced_column_down.sql |   9 +
 .../20250210215603_add_last_synced_column.sql      |  14 ++
 supabase/scripts/test-migration.sh                 |   0
 supabase/templates/migration_template.sql          |   0
 17 files changed, 467 insertions(+), 2 deletions(-)

## 1f9bb88
**Date:** 2025-02-10 19:18:33 -0800
**Message:** google drive integration documentation to consider - settle on a hybrid approach?

**Files Changed:**



 .../src/components/ExpertFolderAnalysis.tsx        | 176 ++++--
 docs/google-drive-integration.md                   | 684 ++++++++++++++++++---
 2 files changed, 701 insertions(+), 159 deletions(-)

## eaaf43c
**Date:** 2025-02-10 18:43:16 -0800
**Message:** wow - a nice interface already for choosing the files

**Files Changed:**



 .cursorrules                                       |  38 +++++++
 .../src/components/ExpertFolderAnalysis.tsx        | 124 +++++++++++++++++++++
 .../src/lib/supabase/expert-documents.ts           |  43 +++++++
 .../src/pages/ExpertProfiles.tsx                   |  51 +++++----
 apps/dhg-improve-experts/src/types/expert.ts       |   9 ++
 5 files changed, 242 insertions(+), 23 deletions(-)

## b3fff64
**Date:** 2025-02-10 18:30:52 -0800
**Message:** pnpm list-backups is improved

**Files Changed:**



 scripts/app-management/list-backups.sh | 83 ++++++++++++++++++++++------------
 1 file changed, 55 insertions(+), 28 deletions(-)

## 119a98e
**Date:** 2025-02-10 17:42:14 -0800
**Message:** fixed git ignore

**Files Changed:**



 .gitignore | 2 ++
 1 file changed, 2 insertions(+)

## 976cb5d
**Date:** 2025-02-10 17:37:12 -0800
**Message:** add the updated gitignore

**Files Changed:**



 .gitignore | 8 ++++++++
 1 file changed, 8 insertions(+)

## b24b92c
**Date:** 2025-02-10 17:34:55 -0800
**Message:** chore: update gitignore to exclude all env files and credentials

**Files Changed:**



 .gitignore | 24 ++++++++++++++----------
 1 file changed, 14 insertions(+), 10 deletions(-)

## 43c1fb6
**Date:** 2025-02-10 17:31:40 -0800
**Message:** chore: ignore backup files

**Files Changed:**



 .gitignore | 3 +++
 1 file changed, 3 insertions(+)

## 978e444
**Date:** 2025-02-10 10:21:22 -0800
**Message:** button works to extract the files and folders for 85 records

**Files Changed:**



 .../src/lib/google-drive/sync.ts                   | 81 +++++++++++++++-------
 .../src/pages/ExpertProfiles.tsx                   | 65 ++++++-----------
 2 files changed, 77 insertions(+), 69 deletions(-)

## ee236a5
**Date:** 2025-02-10 09:46:09 -0800
**Message:** tyring to fix  buttons and new rule about not breaking things

**Files Changed:**



 .cursorrules                                       |  42 +++++
 .../src/lib/google-drive/sync.ts                   |  72 ++++++++-
 .../src/pages/ExpertProfiles.tsx                   |  31 ++--
 docs/google-drive-integration.md                   | 175 +++++++++++++++------
 4 files changed, 253 insertions(+), 67 deletions(-)

## 5d23001
**Date:** 2025-02-10 08:56:13 -0800
**Message:** okay - I had a commit msg error so now all these different files will be committed for postgres

**Files Changed:**



 .cursorrules                                       | 40 ++++++++++++++++++++++
 apps/dhg-improve-experts/supabase/.temp/cli-latest |  1 +
 .../supabase/.temp/gotrue-version                  |  1 +
 apps/dhg-improve-experts/supabase/.temp/pooler-url |  1 +
 .../supabase/.temp/postgres-version                |  1 +
 .../dhg-improve-experts/supabase/.temp/project-ref |  1 +
 .../supabase/.temp/rest-version                    |  1 +
 .../supabase/.temp/storage-version                 |  1 +
 custom_instructions                                | 38 ++++++++++++++++++++
 9 files changed, 85 insertions(+)

## e4af68b
**Date:** 2025-02-10 08:28:35 -0800
**Message:** feat: add script to reset sources_google table for development

**Files Changed:**



 package.json | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

## 4863b79
**Date:** 2025-02-10 08:19:19 -0800
**Message:** add button to put in database

**Files Changed:**



 .../src/pages/ExpertProfiles.tsx                   | 65 +++++++++++++++-------
 1 file changed, 44 insertions(+), 21 deletions(-)

## cf49109
**Date:** 2025-02-09 18:54:54 -0800
**Message:** added the root record

**Files Changed:**



 .../src/lib/google-drive/sync.ts                   | 19 +++++++++++-
 .../dhg-improve-experts/src/lib/supabase/client.ts | 17 +++++++++++
 .../src/lib/supabase/sources-google.ts             | 20 +++++++++++++
 apps/dhg-improve-experts/src/lib/supabase/types.ts | 11 ++-----
 .../src/pages/ExpertProfiles.tsx                   | 34 ++++++++++++++++++++++
 docs/google-drive-integration.md                   | 13 ++++++++-
 supabase/client/index.ts                           |  6 ++++
 supabase/types/index.ts                            | 28 ++++++++++++++++++
 8 files changed, 138 insertions(+), 10 deletions(-)

## f8dd36f
**Date:** 2025-02-09 18:24:35 -0800
**Message:** did a successful migration

**Files Changed:**



 docs/migrations.md | 40 +++++++++++++++++++++++++++++++++++++++-
 1 file changed, 39 insertions(+), 1 deletion(-)

## 1fef748
**Date:** 2025-02-09 18:17:55 -0800
**Message:** more migration info

**Files Changed:**



 docs/migrations.md | 17 +++++++++++++++++
 1 file changed, 17 insertions(+)

## fb3c93d
**Date:** 2025-02-09 18:08:00 -0800
**Message:** changed migrations again

**Files Changed:**



 docs/migrations.md                                 | 37 ++++++++++++++++++++++
 ...ql => 20250210015657_create_sources_google.sql} |  0
 ...0250210015657_create_sources_google_v2.down.sql | 28 ----------------
 .../20250210020656_create_sources_google_down.sql  |  0
 4 files changed, 37 insertions(+), 28 deletions(-)

## 9a46078
**Date:** 2025-02-09 18:03:31 -0800
**Message:** updated migrations doc

**Files Changed:**



 docs/migrations.md | 14 +++++++-------
 1 file changed, 7 insertions(+), 7 deletions(-)

## ad985ad
**Date:** 2025-02-09 18:00:31 -0800
**Message:** swicthed migration files

**Files Changed:**



 ...s_google.down.sql => 20250210015657_create_sources_google_v2.down.sql} | 0
 ...ate_sources_google.sql => 20250210015657_create_sources_google_v2.sql} | 0
 2 files changed, 0 insertions(+), 0 deletions(-)

## 0c1df3c
**Date:** 2025-02-09 16:51:38 -0800
**Message:** doing the google source restore (down) script

**Files Changed:**



 docs/migrations.md | 14 ++++++++++----
 1 file changed, 10 insertions(+), 4 deletions(-)

## 6a4400d
**Date:** 2025-02-09 16:44:12 -0800
**Message:** fixed migration script

**Files Changed:**



 .../20240308000000_create_sources_google.sql        | 21 ++++++++-------------
 1 file changed, 8 insertions(+), 13 deletions(-)

## b8cddbc
**Date:** 2025-02-09 16:42:12 -0800
**Message:** check in a supa migration for creating sources google file

**Files Changed:**



 .../src/lib/google-drive/sync.ts                   |  29 +++
 .../src/lib/supabase/sources-google.ts             |  81 ++++++
 apps/dhg-improve-experts/src/lib/supabase/types.ts |  24 ++
 docs/migrations.md                                 |  46 ++++
 package.json                                       |   1 +
 pnpm-lock.yaml                                     | 119 +++++++++
 supabase/.gitignore                                |   8 +
 supabase/config.toml                               | 281 +++++++++++++++++++++
 .../20240308000000_create_sources_google.down.sql  |  28 ++
 .../20240308000000_create_sources_google.sql       | 108 ++++++++
 10 files changed, 725 insertions(+)

## 22eece2
**Date:** 2025-02-09 09:30:23 -0800
**Message:** pdfs now work

**Files Changed:**



 apps/dhg-improve-experts/package.json            |  1 +
 apps/dhg-improve-experts/src/lib/google-drive.ts | 38 ++++++++++--
 apps/dhg-improve-experts/src/lib/pdf-utils.ts    | 18 ++++++
 apps/dhg-improve-experts/vite.config.js          | 12 +++-
 docs/google-drive-integration.md                 | 60 ++++++++++++++++++
 pnpm-lock.yaml                                   | 78 +++++++++++++++++++++---
 6 files changed, 194 insertions(+), 13 deletions(-)

## ba7368f
**Date:** 2025-02-08 22:26:04 -0800
**Message:** it works to get the file contents

**Files Changed:**



 apps/dhg-improve-experts/package.json              |   1 +
 apps/dhg-improve-experts/src/lib/google-drive.ts   | 109 +++++++++++++++-----
 .../src/pages/ExpertProfiles.tsx                   |  80 ++++++++-------
 pnpm-lock.yaml                                     | 113 +++++++++++++++++++++
 4 files changed, 246 insertions(+), 57 deletions(-)

## e69f4fc
**Date:** 2025-02-08 22:13:44 -0800
**Message:** works to open up files in google drvie

**Files Changed:**



 apps/dhg-improve-experts/src/lib/google-drive.ts   |  23 ++++
 .../src/pages/ExpertProfiles.tsx                   | 141 +++++++++++++++++++--
 2 files changed, 150 insertions(+), 14 deletions(-)

## 7383d13
**Date:** 2025-02-08 22:09:26 -0800
**Message:** got the google drive reading working

**Files Changed:**



 apps/dhg-improve-experts/package.json            |   2 -
 apps/dhg-improve-experts/src/lib/google-drive.ts |  37 +-
 pnpm-lock.yaml                                   | 520 +++++++++--------------
 3 files changed, 210 insertions(+), 349 deletions(-)

## c6daa91
**Date:** 2025-02-08 22:05:37 -0800
**Message:** added bunch of stuff for simplifying to just do basic functionality

**Files Changed:**



 apps/dhg-improve-experts/netlify.toml              |  21 +-
 apps/dhg-improve-experts/package.json              |   2 +
 apps/dhg-improve-experts/src/App.tsx               |  40 +--
 .../src/components/auth/ProtectedRoute.tsx         |  28 --
 .../src/components/layout/MainLayout.tsx           |   4 +-
 apps/dhg-improve-experts/src/hooks/use-mobile.tsx  |  19 --
 apps/dhg-improve-experts/src/hooks/use-toast.ts    | 191 -----------
 apps/dhg-improve-experts/src/hooks/useAuth.tsx     | 116 -------
 .../src/integrations/supabase/client.ts            |   8 +-
 apps/dhg-improve-experts/src/lib/google-drive.ts   |  42 +++
 apps/dhg-improve-experts/src/lib/utils.ts          |   8 +-
 apps/dhg-improve-experts/src/pages/Auth.tsx        | 243 -------------
 .../src/pages/DocumentTypes.tsx                    | 159 ---------
 .../src/pages/ExpertProfiles.tsx                   |  93 +++++
 apps/dhg-improve-experts/src/pages/Index.tsx       |  96 ------
 apps/dhg-improve-experts/src/pages/NotFound.tsx    |  27 --
 apps/dhg-improve-experts/vite.config.js            |  23 ++
 pnpm-lock.yaml                                     | 375 +++++++++++++++++++++
 18 files changed, 563 insertions(+), 932 deletions(-)

## 5535f35
**Date:** 2025-02-08 21:05:26 -0800
**Message:** adding new app called dhg-improve-experts to leverage supabase yet not deal with the dashboard

**Files Changed:**



 apps/dhg-improve-experts/.env.example              |    1 +
 apps/dhg-improve-experts/.gitignore                |   29 +
 apps/dhg-improve-experts/README.md                 |   71 +
 apps/dhg-improve-experts/bun.lockb                 |  Bin 0 -> 187199 bytes
 apps/dhg-improve-experts/components.json           |   20 +
 apps/dhg-improve-experts/eslint.config.js          |   29 +
 apps/dhg-improve-experts/index.html                |   17 +
 apps/dhg-improve-experts/netlify.toml              |   21 +
 apps/dhg-improve-experts/package-lock.json         | 6402 ++++++++++++++++++++
 apps/dhg-improve-experts/package.json              |   96 +
 apps/dhg-improve-experts/postcss.config.cjs        |    6 +
 apps/dhg-improve-experts/public/favicon.ico        |  Bin 0 -> 15086 bytes
 apps/dhg-improve-experts/public/og-image.png       |  Bin 0 -> 233240 bytes
 apps/dhg-improve-experts/public/placeholder.svg    |    1 +
 apps/dhg-improve-experts/src/App.css               |   42 +
 apps/dhg-improve-experts/src/App.tsx               |   49 +
 .../src/components/EnvironmentBadge.tsx            |   19 +
 apps/dhg-improve-experts/src/components/Header.tsx |   48 +
 .../src/components/auth/ProtectedRoute.tsx         |   28 +
 .../components/document-types/DocumentTypeForm.tsx |  149 +
 .../src/components/experts/ExpertForm.tsx          |  168 +
 .../src/components/layout/Header.tsx               |   82 +
 .../src/components/layout/MainLayout.tsx           |   14 +
 .../src/components/ui/accordion.tsx                |   56 +
 .../src/components/ui/alert-dialog.tsx             |  139 +
 .../src/components/ui/alert.tsx                    |   59 +
 .../src/components/ui/aspect-ratio.tsx             |    5 +
 .../src/components/ui/avatar.tsx                   |   48 +
 .../src/components/ui/badge.tsx                    |   36 +
 .../src/components/ui/breadcrumb.tsx               |  115 +
 .../src/components/ui/button.tsx                   |   56 +
 .../src/components/ui/calendar.tsx                 |   64 +
 .../dhg-improve-experts/src/components/ui/card.tsx |   79 +
 .../src/components/ui/carousel.tsx                 |  260 +
 .../src/components/ui/chart.tsx                    |  363 ++
 .../src/components/ui/checkbox.tsx                 |   28 +
 .../src/components/ui/collapsible.tsx              |    9 +
 .../src/components/ui/command.tsx                  |  153 +
 .../src/components/ui/context-menu.tsx             |  198 +
 .../src/components/ui/dialog.tsx                   |  120 +
 .../src/components/ui/drawer.tsx                   |  116 +
 .../src/components/ui/dropdown-menu.tsx            |  198 +
 .../dhg-improve-experts/src/components/ui/form.tsx |  176 +
 .../src/components/ui/hover-card.tsx               |   27 +
 .../src/components/ui/input-otp.tsx                |   69 +
 .../src/components/ui/input.tsx                    |   22 +
 .../src/components/ui/label.tsx                    |   24 +
 .../src/components/ui/menubar.tsx                  |  234 +
 .../src/components/ui/navigation-menu.tsx          |  128 +
 .../src/components/ui/pagination.tsx               |  117 +
 .../src/components/ui/popover.tsx                  |   29 +
 .../src/components/ui/progress.tsx                 |   26 +
 .../src/components/ui/radio-group.tsx              |   42 +
 .../src/components/ui/resizable.tsx                |   43 +
 .../src/components/ui/scroll-area.tsx              |   46 +
 .../src/components/ui/select.tsx                   |  158 +
 .../src/components/ui/separator.tsx                |   29 +
 .../src/components/ui/sheet.tsx                    |  131 +
 .../src/components/ui/sidebar.tsx                  |  761 +++
 .../src/components/ui/skeleton.tsx                 |   15 +
 .../src/components/ui/slider.tsx                   |   26 +
 .../src/components/ui/sonner.tsx                   |   29 +
 .../src/components/ui/switch.tsx                   |   27 +
 .../src/components/ui/table.tsx                    |  117 +
 .../dhg-improve-experts/src/components/ui/tabs.tsx |   53 +
 .../src/components/ui/textarea.tsx                 |   24 +
 .../src/components/ui/toast.tsx                    |  127 +
 .../src/components/ui/toaster.tsx                  |   33 +
 .../src/components/ui/toggle-group.tsx             |   59 +
 .../src/components/ui/toggle.tsx                   |   43 +
 .../src/components/ui/tooltip.tsx                  |   28 +
 .../src/components/ui/use-toast.ts                 |    3 +
 apps/dhg-improve-experts/src/hooks/use-mobile.tsx  |   19 +
 apps/dhg-improve-experts/src/hooks/use-toast.ts    |  191 +
 apps/dhg-improve-experts/src/hooks/useAuth.tsx     |  116 +
 apps/dhg-improve-experts/src/index.css             |   25 +
 .../src/integrations/supabase/client.ts            |   11 +
 .../src/integrations/supabase/types.ts             | 1095 ++++
 apps/dhg-improve-experts/src/lib/utils.ts          |    6 +
 apps/dhg-improve-experts/src/main.tsx              |    6 +
 apps/dhg-improve-experts/src/pages/Auth.tsx        |  243 +
 .../src/pages/DocumentTypes.tsx                    |  159 +
 apps/dhg-improve-experts/src/pages/Experts.tsx     |   73 +
 apps/dhg-improve-experts/src/pages/Index.tsx       |   96 +
 apps/dhg-improve-experts/src/pages/NotFound.tsx    |   27 +
 apps/dhg-improve-experts/src/services/api.ts       |   72 +
 .../src/types/supabase/index.ts                    |   22 +
 apps/dhg-improve-experts/src/vite-env.d.ts         |    1 +
 apps/dhg-improve-experts/supabase/config.toml      |    1 +
 apps/dhg-improve-experts/tailwind.config.cjs       |   51 +
 apps/dhg-improve-experts/tailwind.config.ts        |   82 +
 apps/dhg-improve-experts/tsconfig.app.json         |   30 +
 apps/dhg-improve-experts/tsconfig.json             |   19 +
 apps/dhg-improve-experts/tsconfig.node.json        |   22 +
 apps/dhg-improve-experts/vite.config.ts            |   51 +
 95 files changed, 14458 insertions(+)

## 303c139
**Date:** 2025-02-08 14:55:59 -0800
**Message:** changing the dist file - which way is it?

**Files Changed:**



 apps/dhg-hub-lovable/netlify.toml | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

## e4d47e8
**Date:** 2025-02-08 14:51:39 -0800
**Message:** dif verskin specified

**Files Changed:**



 pnpm-lock.yaml | 25 +++++++++++++++++--------
 1 file changed, 17 insertions(+), 8 deletions(-)

## 1e64b7b
**Date:** 2025-02-08 09:52:59 -0800
**Message:** feat: add dhg-hub-lovable app with working experts and auth

**Files Changed:**



## b57ef56
**Date:** 2025-02-08 09:47:46 -0800
**Message:** merge: pnpm-lock.yaml from lovable-transfer

**Files Changed:**



 pnpm-lock.yaml | 2780 ++++++++++++++++++++++++++++++++++++++++++++++++++++----
 1 file changed, 2589 insertions(+), 191 deletions(-)

## 6d2af9e
**Date:** 2025-02-08 09:47:21 -0800
**Message:** merge: deploy-app.sh from lovable-transfer

**Files Changed:**



 scripts/deployment/deploy-app.sh | 44 ++++++++--------------------------------
 1 file changed, 9 insertions(+), 35 deletions(-)

## 6da096e
**Date:** 2025-02-08 09:46:33 -0800
**Message:** merge: package.json from lovable-transfer

**Files Changed:**



 apps/dhg-hub-lovable/package.json | 96 +++++++++++++++++++++++++++++++++++++++
 1 file changed, 96 insertions(+)

## a45b630
**Date:** 2025-02-08 09:36:29 -0800
**Message:** check in to get the functionality restored from before

**Files Changed:**



 apps/dhg-hub-lovable/src/components/Header.tsx | 15 ++---
 apps/dhg-hub-lovable/src/pages/Experts.tsx     | 82 ++++++++++++++------------
 scripts/deployment/deploy-app.sh               |  9 +--
 3 files changed, 56 insertions(+), 50 deletions(-)

## 44909a9
**Date:** 2025-02-08 09:06:33 -0800
**Message:** better cards and signout working

**Files Changed:**



 apps/dhg-hub-lovable/src/App.tsx               |   7 +-
 apps/dhg-hub-lovable/src/components/Header.tsx |  47 ++++++
 apps/dhg-hub-lovable/src/pages/Experts.tsx     | 197 +++++++------------------
 3 files changed, 103 insertions(+), 148 deletions(-)

## f508c69
**Date:** 2025-02-08 08:58:35 -0800
**Message:** putting back color thems

**Files Changed:**



 apps/dhg-hub-lovable/src/index.css       | 24 ++++++++++++++++-
 apps/dhg-hub-lovable/tailwind.config.cjs | 44 ++++++++++++++++++++++++++++++--
 2 files changed, 65 insertions(+), 3 deletions(-)

## 17bd762
**Date:** 2025-02-08 08:49:14 -0800
**Message:** fix deploy script

**Files Changed:**



 scripts/deployment/deploy-app.sh | 9 ++++++---
 1 file changed, 6 insertions(+), 3 deletions(-)

## 2ac62c6
**Date:** 2025-02-08 08:45:45 -0800
**Message:** added preview script

**Files Changed:**



 package.json | 5 ++++-
 1 file changed, 4 insertions(+), 1 deletion(-)

## c9c7782
**Date:** 2025-02-08 08:43:48 -0800
**Message:** it works to build now

**Files Changed:**



 apps/dhg-hub-lovable/package.json                  | 14 ++++----
 .../src/components/EnvironmentBadge.tsx            | 20 +++++++++++-
 apps/dhg-hub-lovable/src/index.css                 | 37 +---------------------
 apps/dhg-hub-lovable/src/main.tsx                  |  3 +-
 pnpm-lock.yaml                                     |  4 +--
 5 files changed, 31 insertions(+), 47 deletions(-)

## ea26871
**Date:** 2025-02-08 08:34:32 -0800
**Message:** newer version of tailwind

**Files Changed:**



 apps/dhg-hub-lovable/{postcss.config.js => postcss.config.cjs}   | 4 ++--
 apps/dhg-hub-lovable/{tailwind.config.js => tailwind.config.cjs} | 2 +-
 2 files changed, 3 insertions(+), 3 deletions(-)

## 7167101
**Date:** 2025-02-08 08:30:29 -0800
**Message:** putting a color badge on the version

**Files Changed:**



 apps/dhg-hub-lovable/src/App.tsx                   |     6 +
 .../src/components/EnvironmentBadge.tsx            |     1 +
 apps/dhg-hub-lovable/tailwind.config.js            |    11 +
 pnpm-lock.yaml                                     | 10849 ++++++++++++-------
 4 files changed, 6779 insertions(+), 4088 deletions(-)

## 6a7e1ef
**Date:** 2025-02-08 08:09:11 -0800
**Message:** added examples to dhg-lovalbe for env

**Files Changed:**



 apps/dhg-hub-lovable/.env.example |  1 +
 apps/dhg-hub-lovable/.gitignore   |  5 +++++
 apps/dhg-hub-lovable/netlify.toml | 12 +++++++++---
 apps/dhg-hub-lovable/package.json | 35 +++++++++++++++++++++++------------
 4 files changed, 38 insertions(+), 15 deletions(-)

## c81afe6
**Date:** 2025-02-08 07:56:05 -0800
**Message:** updated netlify and vite config to align with dhg-a

**Files Changed:**



 apps/dhg-hub-lovable/netlify.toml   | 15 +++++++++
 apps/dhg-hub-lovable/vite.config.ts | 67 ++++++++++++++++++++++++++-----------
 2 files changed, 63 insertions(+), 19 deletions(-)

## 9dcaad5
**Date:** 2025-02-08 07:44:15 -0800
**Message:** check in all new files from the dhg-lovable

**Files Changed:**



 apps/dhg-hub-lovable/.gitignore                    |   24 +
 apps/dhg-hub-lovable/README.md                     |   71 +
 apps/dhg-hub-lovable/bun.lockb                     |  Bin 0 -> 187199 bytes
 apps/dhg-hub-lovable/components.json               |   20 +
 apps/dhg-hub-lovable/eslint.config.js              |   29 +
 apps/dhg-hub-lovable/index.html                    |   17 +
 apps/dhg-hub-lovable/package-lock.json             | 6402 ++++++++++++++++++++
 apps/dhg-hub-lovable/package.json                  |   85 +
 apps/dhg-hub-lovable/postcss.config.js             |    6 +
 apps/dhg-hub-lovable/public/favicon.ico            |  Bin 0 -> 15086 bytes
 apps/dhg-hub-lovable/public/og-image.png           |  Bin 0 -> 233240 bytes
 apps/dhg-hub-lovable/public/placeholder.svg        |    1 +
 apps/dhg-hub-lovable/src/App.css                   |   42 +
 apps/dhg-hub-lovable/src/App.tsx                   |   44 +
 .../src/components/auth/ProtectedRoute.tsx         |   28 +
 .../components/document-types/DocumentTypeForm.tsx |  149 +
 .../src/components/experts/ExpertForm.tsx          |  168 +
 .../src/components/layout/Header.tsx               |   82 +
 .../src/components/layout/MainLayout.tsx           |   14 +
 .../src/components/ui/accordion.tsx                |   56 +
 .../src/components/ui/alert-dialog.tsx             |  139 +
 apps/dhg-hub-lovable/src/components/ui/alert.tsx   |   59 +
 .../src/components/ui/aspect-ratio.tsx             |    5 +
 apps/dhg-hub-lovable/src/components/ui/avatar.tsx  |   48 +
 apps/dhg-hub-lovable/src/components/ui/badge.tsx   |   36 +
 .../src/components/ui/breadcrumb.tsx               |  115 +
 apps/dhg-hub-lovable/src/components/ui/button.tsx  |   56 +
 .../dhg-hub-lovable/src/components/ui/calendar.tsx |   64 +
 apps/dhg-hub-lovable/src/components/ui/card.tsx    |   79 +
 .../dhg-hub-lovable/src/components/ui/carousel.tsx |  260 +
 apps/dhg-hub-lovable/src/components/ui/chart.tsx   |  363 ++
 .../dhg-hub-lovable/src/components/ui/checkbox.tsx |   28 +
 .../src/components/ui/collapsible.tsx              |    9 +
 apps/dhg-hub-lovable/src/components/ui/command.tsx |  153 +
 .../src/components/ui/context-menu.tsx             |  198 +
 apps/dhg-hub-lovable/src/components/ui/dialog.tsx  |  120 +
 apps/dhg-hub-lovable/src/components/ui/drawer.tsx  |  116 +
 .../src/components/ui/dropdown-menu.tsx            |  198 +
 apps/dhg-hub-lovable/src/components/ui/form.tsx    |  176 +
 .../src/components/ui/hover-card.tsx               |   27 +
 .../src/components/ui/input-otp.tsx                |   69 +
 apps/dhg-hub-lovable/src/components/ui/input.tsx   |   22 +
 apps/dhg-hub-lovable/src/components/ui/label.tsx   |   24 +
 apps/dhg-hub-lovable/src/components/ui/menubar.tsx |  234 +
 .../src/components/ui/navigation-menu.tsx          |  128 +
 .../src/components/ui/pagination.tsx               |  117 +
 apps/dhg-hub-lovable/src/components/ui/popover.tsx |   29 +
 .../dhg-hub-lovable/src/components/ui/progress.tsx |   26 +
 .../src/components/ui/radio-group.tsx              |   42 +
 .../src/components/ui/resizable.tsx                |   43 +
 .../src/components/ui/scroll-area.tsx              |   46 +
 apps/dhg-hub-lovable/src/components/ui/select.tsx  |  158 +
 .../src/components/ui/separator.tsx                |   29 +
 apps/dhg-hub-lovable/src/components/ui/sheet.tsx   |  131 +
 apps/dhg-hub-lovable/src/components/ui/sidebar.tsx |  761 +++
 .../dhg-hub-lovable/src/components/ui/skeleton.tsx |   15 +
 apps/dhg-hub-lovable/src/components/ui/slider.tsx  |   26 +
 apps/dhg-hub-lovable/src/components/ui/sonner.tsx  |   29 +
 apps/dhg-hub-lovable/src/components/ui/switch.tsx  |   27 +
 apps/dhg-hub-lovable/src/components/ui/table.tsx   |  117 +
 apps/dhg-hub-lovable/src/components/ui/tabs.tsx    |   53 +
 .../dhg-hub-lovable/src/components/ui/textarea.tsx |   24 +
 apps/dhg-hub-lovable/src/components/ui/toast.tsx   |  127 +
 apps/dhg-hub-lovable/src/components/ui/toaster.tsx |   33 +
 .../src/components/ui/toggle-group.tsx             |   59 +
 apps/dhg-hub-lovable/src/components/ui/toggle.tsx  |   43 +
 apps/dhg-hub-lovable/src/components/ui/tooltip.tsx |   28 +
 .../dhg-hub-lovable/src/components/ui/use-toast.ts |    3 +
 apps/dhg-hub-lovable/src/hooks/use-mobile.tsx      |   19 +
 apps/dhg-hub-lovable/src/hooks/use-toast.ts        |  191 +
 apps/dhg-hub-lovable/src/hooks/useAuth.tsx         |  116 +
 apps/dhg-hub-lovable/src/index.css                 |   38 +
 .../src/integrations/supabase/client.ts            |   11 +
 .../src/integrations/supabase/types.ts             | 1095 ++++
 apps/dhg-hub-lovable/src/lib/utils.ts              |    6 +
 apps/dhg-hub-lovable/src/main.tsx                  |    5 +
 apps/dhg-hub-lovable/src/pages/Auth.tsx            |  243 +
 apps/dhg-hub-lovable/src/pages/DocumentTypes.tsx   |  159 +
 apps/dhg-hub-lovable/src/pages/Experts.tsx         |  156 +
 apps/dhg-hub-lovable/src/pages/Index.tsx           |   96 +
 apps/dhg-hub-lovable/src/pages/NotFound.tsx        |   27 +
 apps/dhg-hub-lovable/src/services/api.ts           |   72 +
 apps/dhg-hub-lovable/src/types/supabase/index.ts   |   22 +
 apps/dhg-hub-lovable/src/vite-env.d.ts             |    1 +
 apps/dhg-hub-lovable/supabase/config.toml          |    1 +
 apps/dhg-hub-lovable/tailwind.config.ts            |   82 +
 apps/dhg-hub-lovable/tsconfig.app.json             |   30 +
 apps/dhg-hub-lovable/tsconfig.json                 |   19 +
 apps/dhg-hub-lovable/tsconfig.node.json            |   22 +
 apps/dhg-hub-lovable/vite.config.ts                |   22 +
 scripts/app-management/copy-lovable-app.sh         |   27 +-
 91 files changed, 14384 insertions(+), 6 deletions(-)

## 01ca02f
**Date:** 2025-02-08 07:31:12 -0800
**Message:** adding tests to turbo

**Files Changed:**



 turbo.json | 16 ++++++++++++++--
 1 file changed, 14 insertions(+), 2 deletions(-)

## 1a0706a
**Date:** 2025-02-08 07:30:54 -0800
**Message:** adding tests

**Files Changed:**



 package.json | 2 ++
 1 file changed, 2 insertions(+)

## 2cc9e7e
**Date:** 2025-02-08 07:26:23 -0800
**Message:** explict packages to add

**Files Changed:**



 apps/dhg-a/package.json | 22 +++++++++++-----------
 pnpm-lock.yaml          | 22 +++++++++++-----------
 2 files changed, 22 insertions(+), 22 deletions(-)

## c670162
**Date:** 2025-02-08 07:12:37 -0800
**Message:** updating the lovable script

**Files Changed:**



 scripts/app-management/copy-lovable-app.sh | 46 +++++++++++++++++++++++-------
 1 file changed, 35 insertions(+), 11 deletions(-)

## 0acea1b
**Date:** 2025-02-07 22:36:02 -0800
**Message:** working on the netlify api functions

**Files Changed:**



 apps/dhg-a/netlify.toml                |  2 +-
 docs/deployment/deployment-workflow.md | 17 +++++++++++++++++
 2 files changed, 18 insertions(+), 1 deletion(-)

## e118d61
**Date:** 2025-02-07 22:27:27 -0800
**Message:** updating toml for some reason

**Files Changed:**



 apps/dhg-a/.gitignore   |  8 +++++++-
 apps/dhg-a/netlify.toml | 18 ++++++++++++++----
 2 files changed, 21 insertions(+), 5 deletions(-)

## 5f7a13e
**Date:** 2025-02-07 22:15:45 -0800
**Message:** fixing urls to void security warning

**Files Changed:**



 apps/dhg-a/netlify.toml | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

## eb0fbfa
**Date:** 2025-02-07 22:12:51 -0800
**Message:** add a test for dhg-hub url

**Files Changed:**



 apps/dhg-a/netlify.toml | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

## 6746b7e
**Date:** 2025-02-07 21:50:28 -0800
**Message:** more documentations

**Files Changed:**



 docs/deployment/deployment-workflow.md | 71 ++++++++++++++++++++++++++++++++++
 1 file changed, 71 insertions(+)

## ebde05e
**Date:** 2025-02-07 21:47:29 -0800
**Message:** messing with colors for the badge

**Files Changed:**



 apps/dhg-a/netlify.toml          |  2 +-
 apps/dhg-a/src/App.jsx           | 13 +++++++++++--
 scripts/deployment/deploy-app.sh |  4 ++++
 3 files changed, 16 insertions(+), 3 deletions(-)

## bd81d1c
**Date:** 2025-02-07 21:42:08 -0800
**Message:** fixing colors

**Files Changed:**



 apps/dhg-a/src/App.jsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

## ecde1fd
**Date:** 2025-02-07 21:36:43 -0800
**Message:** tests work now

**Files Changed:**



 apps/dhg-a/src/App.jsx        | 18 ++++++++++++------
 apps/dhg-a/src/test/utils.tsx | 11 +++++++++++
 2 files changed, 23 insertions(+), 6 deletions(-)

## 2f1fe3f
**Date:** 2025-02-07 21:34:55 -0800
**Message:** prod is now fixed for variables.

**Files Changed:**



 apps/dhg-a/netlify.toml | 1 +
 1 file changed, 1 insertion(+)

## 59683aa
**Date:** 2025-02-07 21:33:04 -0800
**Message:** tweaking the development vars

**Files Changed:**



 apps/dhg-a/netlify.toml          | 1 +
 package.json                     | 2 +-
 scripts/deployment/deploy-app.sh | 5 ++++-
 3 files changed, 6 insertions(+), 2 deletions(-)

## b8240f5
**Date:** 2025-02-07 21:30:13 -0800
**Message:** showing preview now

**Files Changed:**



 apps/dhg-a/netlify.toml          |  2 +-
 apps/dhg-a/src/App.jsx           |  4 +++-
 scripts/deployment/deploy-app.sh | 11 +++++++++--
 3 files changed, 13 insertions(+), 4 deletions(-)

## 2e278ed
**Date:** 2025-02-07 21:26:08 -0800
**Message:** fixing to get the preview url right

**Files Changed:**



 apps/dhg-a/netlify.toml | 5 ++++-
 package.json            | 4 +++-
 2 files changed, 7 insertions(+), 2 deletions(-)

## 73b362c
**Date:** 2025-02-07 21:21:32 -0800
**Message:** fixing path issues

**Files Changed:**



 docs/deployment/deployment-workflow.md | 126 ++-------------------------------
 scripts/deployment/deploy-app.sh       |   7 +-
 2 files changed, 12 insertions(+), 121 deletions(-)

## d571487
**Date:** 2025-02-07 21:13:06 -0800
**Message:** add these changes

**Files Changed:**



 apps/dhg-a/netlify.toml          | 12 +++++++++++-
 apps/dhg-a/src/App.jsx           |  9 ++++++++-
 scripts/deployment/deploy-app.sh | 23 ++++++++++++++++-------
 3 files changed, 35 insertions(+), 9 deletions(-)

## 5f606f9
**Date:** 2025-02-07 21:07:51 -0800
**Message:** added test for tailwind

**Files Changed:**



 apps/dhg-a/package.json        |   3 +
 apps/dhg-a/postcss.config.cjs  |   7 ++
 apps/dhg-a/src/App.jsx         |   7 +-
 apps/dhg-a/src/index.css       |   3 +
 apps/dhg-a/src/main.jsx        |   1 +
 apps/dhg-a/tailwind.config.cjs |  15 +++
 pnpm-lock.yaml                 | 275 +++++++++++++++++++++++++++++++++++++++++
 7 files changed, 310 insertions(+), 1 deletion(-)

## bbb4706
**Date:** 2025-02-07 20:28:45 -0800
**Message:** fixed toml file

**Files Changed:**



 apps/dhg-a/netlify.toml | 30 ++++++++++++------------------
 1 file changed, 12 insertions(+), 18 deletions(-)

## 3c6f3d5
**Date:** 2025-02-07 20:23:08 -0800
**Message:** add color badge for environments

**Files Changed:**



 apps/dhg-a/netlify.toml | 18 +++++++++++++++---
 apps/dhg-a/src/App.jsx  | 41 +++++++++++++++++++++++++++++++++++++++--
 2 files changed, 54 insertions(+), 5 deletions(-)

## 08abaa2
**Date:** 2025-02-07 19:39:38 -0800
**Message:** feat: add loading spinner component

**Files Changed:**



 apps/dhg-a/src/App.jsx                             | 13 ++++++++-
 .../components/LoadingSpinner/LoadingSpinner.jsx   | 31 ++++++++++++++++++++++
 .../LoadingSpinner/LoadingSpinner.test.jsx         | 15 +++++++++++
 3 files changed, 58 insertions(+), 1 deletion(-)

## 1e4d6f3
**Date:** 2025-02-07 19:19:35 -0800
**Message:** make sure the state.json file is out of source control

**Files Changed:**



 .gitignore            | 3 +++
 apps/dhg-a/.gitignore | 6 +++++-
 apps/dhg-b/.gitignore | 6 +++++-
 3 files changed, 13 insertions(+), 2 deletions(-)

## 4f7f6d8
**Date:** 2025-02-07 19:14:00 -0800
**Message:** trying to get netlify updated

**Files Changed:**



 package.json   |  2 +-
 pnpm-lock.yaml | 26 ++++++++++----------------
 2 files changed, 11 insertions(+), 17 deletions(-)

## f2dec9f
**Date:** 2025-02-07 19:00:33 -0800
**Message:** added themetoggle

**Files Changed:**



 apps/dhg-a/index.html                              | 15 +++++++++++++
 apps/dhg-a/src/App.jsx                             |  9 +++++---
 .../src/components/ThemeToggle/ThemeToggle.jsx     | 18 ++++++++++++++--
 .../components/ThemeToggle/ThemeToggle.test.jsx    | 25 ++++++++++++++++++++++
 4 files changed, 62 insertions(+), 5 deletions(-)

## db395dc
**Date:** 2025-02-07 18:57:33 -0800
**Message:** added a dhg-b .gitignore

**Files Changed:**



 apps/dhg-a/.gitignore |  2 ++
 apps/dhg-b/.gitignore | 14 ++++++++++++++
 2 files changed, 16 insertions(+)

## 60bf5c7
**Date:** 2025-02-07 18:55:57 -0800
**Message:** added more git ignores

**Files Changed:**



 .env.example          |  3 ++-
 .gitignore            | 10 ++++++++--
 apps/dhg-a/.gitignore | 12 ++++++++++++
 3 files changed, 22 insertions(+), 3 deletions(-)

## e944943
**Date:** 2025-02-07 18:52:44 -0800
**Message:** get the backup scripts really working

**Files Changed:**



 scripts/app-management/backup-configs.sh  | 10 +++++++++-
 scripts/app-management/restore-configs.sh |  8 +++++++-
 2 files changed, 16 insertions(+), 2 deletions(-)

## b9b13c2
**Date:** 2025-02-07 18:45:43 -0800
**Message:** setting up environments and going to test them

**Files Changed:**



 .env.example                                       |   5 +-
 apps/dhg-a/netlify.toml                            |  13 ++-
 apps/dhg-a/src/App.jsx                             |   5 +
 .../src/components/ThemeToggle/ThemeToggle.jsx     |  16 +++
 apps/dhg-a/vite.config.js                          |  59 ++++++-----
 docs/deployment/environment-setup.md               | 115 +++++++++++++++++++++
 netlify.toml                                       |  17 ++-
 package.json                                       |  21 +++-
 scripts/deploy.sh                                  |  32 ++++++
 scripts/deployment/backup-env-configs.sh           |  22 ++++
 scripts/deployment/deploy-app.sh                   |  37 +++++++
 scripts/deployment/setup-environments.sh           |  33 ++++++
 12 files changed, 339 insertions(+), 36 deletions(-)

## 02ffabd
**Date:** 2025-02-07 18:24:44 -0800
**Message:** updated documentation

**Files Changed:**



 docs/deployment/deployment-workflow.md | 249 +++++++++++++++++----------------
 1 file changed, 126 insertions(+), 123 deletions(-)

## 60d00fc
**Date:** 2025-02-07 18:17:18 -0800
**Message:** firsst tests in dhg-a

**Files Changed:**



 apps/dhg-a/package.json                          |  16 +-
 apps/dhg-a/src/App.jsx                           |  16 +-
 apps/dhg-a/src/components/App.test.tsx           |  22 +
 apps/dhg-a/src/components/Button/Button.jsx      |  13 +
 apps/dhg-a/src/components/Button/Button.test.tsx |  28 +
 apps/dhg-a/src/components/Header/Header.jsx      |  15 +
 apps/dhg-a/src/components/Header/Header.test.tsx |  20 +
 apps/dhg-a/src/test/setup.ts                     |  12 +
 apps/dhg-a/src/test/utils.tsx                    |  14 +
 apps/dhg-a/vite.config.js                        |  11 +
 docs/deployment/deployment-workflow.md           | 195 ++++++
 pnpm-lock.yaml                                   | 810 ++++++++++++++++++++++-
 12 files changed, 1149 insertions(+), 23 deletions(-)

## 7178310
**Date:** 2025-02-07 18:00:01 -0800
**Message:** setting up ports right

**Files Changed:**



 apps/dhg-a/vite.config.js            |  5 ++++-
 apps/dhg-b/vite.config.js            |  5 ++++-
 docs/project-structure/vite-setup.md | 11 +++++++++--
 3 files changed, 17 insertions(+), 4 deletions(-)

## ce7de9b
**Date:** 2025-02-07 17:57:08 -0800
**Message:** working on initial setup of scripts and backups and restores

**Files Changed:**



 .env.example                                | 22 +++++++
 .gitignore                                  |  5 +-
 docs/project-structure/config-management.md |  3 +-
 docs/project-structure/environment-setup.md | 96 +++++++++++++++++++++++++++++
 docs/tutorials/first-component.md           |  0
 scripts/app-management/backup-configs.sh    |  1 +
 scripts/app-management/restore-configs.sh   |  1 +
 7 files changed, 126 insertions(+), 2 deletions(-)

## 2551bbf
**Date:** 2025-02-07 17:46:32 -0800
**Message:** added basic vite files in each layer to start things on the right foot

**Files Changed:**



 apps/dhg-a/vite.config.js                          |  12 +
 apps/dhg-b/vite.config.js                          |  11 +
 docs/project-structure/vite-configuration-guide.md | 257 +++++++++++++++++++++
 docs/project-structure/vite-setup.md               |  45 ++++
 vite.config.base.js                                |  26 +++
 5 files changed, 351 insertions(+)

## a7ad0ea
**Date:** 2025-02-07 17:35:41 -0800
**Message:** commit files doing sophisticated config backups

**Files Changed:**



 .gitignore                                     |   3 +
 docs/project-structure/backup-restore-guide.md | 178 +++++++++++++++++++++++++
 docs/project-structure/config-management.md    | 138 +++++++++++++++++++
 package.json                                   |   6 +-
 scripts/app-management/backup-configs.sh       |  59 ++++++++
 scripts/app-management/list-backups.sh         |  54 ++++++++
 scripts/app-management/restore-configs.sh      |  47 +++++++
 7 files changed, 484 insertions(+), 1 deletion(-)

## 4f74a1b
**Date:** 2025-02-07 06:37:43 -0800
**Message:** adding scripts to main for copying files from other repositories

**Files Changed:**



 .cursorrules                               | 101 +++++++++++++++++++++++++++++
 docs/concepts/what-is-deployment.md        |  13 ++++
 docs/project-structure/adding-new-apps.md  |  39 +++++++++++
 docs/project-structure/monorepo-layout.md  |  96 +++++++++++++++++++++++++++
 docs/tutorials/first-component.md          |   0
 package.json                               |   3 +-
 scripts/app-management/copy-lovable-app.sh |  21 ++++++
 7 files changed, 272 insertions(+), 1 deletion(-)

## 4531037
**Date:** 2025-02-07 06:12:45 -0800
**Message:** saving gitignore and cursorrules

**Files Changed:**



 .cursorrules | 26 ++++++++++++++++++++++++++
 .gitignore   |  4 ++++
 2 files changed, 30 insertions(+)

## fa206cc
**Date:** 2025-02-07 06:02:59 -0800
**Message:** chore: remove turbo daemon files from git tracking

**Files Changed:**



 .../daemon/950aab6971eb145f-turbo.log.2025-02-07   | 74 ----------------------
 1 file changed, 74 deletions(-)

## cab4acd
**Date:** 2025-02-07 06:02:10 -0800
**Message:** prevent the daemon fles from being added by adding to gitignore

**Files Changed:**



 .gitignore                                          |  5 +++++
 .turbo/daemon/950aab6971eb145f-turbo.log.2025-02-07 | 11 +++++++++++
 2 files changed, 16 insertions(+)

## 15148db
**Date:** 2025-02-07 05:59:24 -0800
**Message:** added netlify build

**Files Changed:**



 .turbo/daemon/950aab6971eb145f-turbo.log.2025-02-07 | 5 +++++
 1 file changed, 5 insertions(+)

## c97f026
**Date:** 2025-02-07 05:55:23 -0800
**Message:** performed netlifty deploy

**Files Changed:**



 .turbo/daemon/950aab6971eb145f-turbo.log.2025-02-07 | 3 +++
 1 file changed, 3 insertions(+)

## d38b01f
**Date:** 2025-02-07 05:54:32 -0800
**Message:** ran netlify build

**Files Changed:**



 .turbo/daemon/950aab6971eb145f-turbo.log.2025-02-07 | 5 +++++
 1 file changed, 5 insertions(+)

## 8642162
**Date:** 2025-02-07 05:53:20 -0800
**Message:** starting files for netlify

**Files Changed:**



 .cursorrules                                       |  206 +
 .gitignore                                         |   46 +-
 .../daemon/950aab6971eb145f-turbo.log.2025-02-07   |   38 +
 package.json                                       |    3 +-
 pnpm-lock.yaml                                     | 8201 +++++++++++++++++++-
 5 files changed, 8318 insertions(+), 176 deletions(-)

## 4534e37
**Date:** 2025-02-07 05:40:53 -0800
**Message:** first setup

**Files Changed:**



 .gitignore                                         |    4 +
 .turbo/cookies/1.cookie                            |    0
 .../daemon/950aab6971eb145f-turbo.log.2025-02-07   |   12 +
 apps/dhg-a/index.html                              |   12 +
 apps/dhg-a/netlify.toml                            |    4 +
 apps/dhg-a/package.json                            |   27 +
 apps/dhg-a/src/App.jsx                             |    9 +
 apps/dhg-a/src/main.jsx                            |    9 +
 apps/dhg-a/vite.config.js                          |    6 +
 apps/dhg-b/index.html                              |   12 +
 apps/dhg-b/netlify.toml                            |    4 +
 apps/dhg-b/package.json                            |   27 +
 apps/dhg-b/src/App.jsx                             |    9 +
 apps/dhg-b/src/main.jsx                            |    9 +
 apps/dhg-b/vite.config.js                          |    6 +
 netlify.toml                                       |    6 +
 package.json                                       |   13 +
 pnpm-lock.yaml                                     | 2999 ++++++++++++++++++++
 pnpm-workspace.yaml                                |    2 +
 root                                               |    8 +
 turbo.json                                         |   16 +
 21 files changed, 3194 insertions(+)
