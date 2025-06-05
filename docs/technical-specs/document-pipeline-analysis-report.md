# Document Pipeline Analysis Report

## Current State Analysis

### Command Usage Statistics

Based on command_tracking data, here's the current usage pattern:

| Command | Usage Count | Status |
|---------|-------------|---------|
| health-check | 9 | Active |
| sync | 3 | Active |
| find-new | 2 | Active |
| show-untyped | 1 | Low usage |
| show-recent | 1 | Low usage |
| test-google-doc-classification | 1 | Test command |
| all | 1 | Low usage |
| classify-rece# Task: write up a script management documentatoin system 
ID: 028582ec-7a35-472b-a3df-567b43235694
Type: feature
Priority: medium

## Description
In the past in dhg-improve-experts I had a dedicated scripts page in the application that helped me manage scripts.  Since then this is what I've learned about what is needed for scripts
1) the mono repo has a scripts folder and underrneat that are the cli-pipelines - many different ones
2) the script_registry is this table that keeps track of the scripts
3) there is a script cli pipeline command set that helped me manage sripts
4) I need you to update that script command set based on what I know now
5) it needs to commands to sync it to what's in the repository 
6) It used hard deletes - if a script is moved or deleted then the script_registry should be updated to reflect that - no soft deletes
7) I do have a sophisticated documnent_type strategy now which needs to be used to reclassify the scripts - there are these major script categories such as Data Processing Script, Deployment Script, Infrastructure Script, Integration Script, and Utility Script
8) if you look at dhg-improve-experts there is a page for script management 
9) It used a dedicated viewer scripts/cli-pipeline/viewers/simple-script-server.js which had to be started in a separate terminal 
10) the viewer was in a window on the right side of the page 
11) the scriptf files need to be presented by which pipeline they are associated with so I need folders for eadch clic pipeline with the scripts listed underneat them and a description of the funtion of the file provided - plus maybe the files are presented by most redcent modified date so I can see that latest activity on a cli pipeline - also add the modified date to the scfipt file descreiptoin as well as the file_size 
12) there are much older scripts that had to do with pnpm commands but it turns out I only need the ones that will help me manage the developjment promoptoion, branching, merging functiopnality - many of the others have fallen away in use as I made the various cli pipelines and those commands became more consistent and replaced the pnpm methodology for most things.  So those old scripts will need to be archived (but not thrown away in case I need them)
13) the main thing that is new - is that almost all of the scripts are built around cli pipelines - it's managing those original scripts that is problematic because I may need a few of them still, but I'm not at that stage - of running tests and managing promotions etc yet, so cleaning them ups is harder.  Write me a vision statement and an implementation plan for addressing these issues - try to keep it simple to start with - ai classifcation for the document_types is crucial, but ai summarizing is not so necessary.  However, now in my instructions when you write new cli pipelines I can have you call some commands that keep the script_registry up to date automatically and since you created the scripts you can help generate meaningful tags. for them.  I want filters and nested folders to appear in the dhg-admin-config on a dedicated sceripts page - to helpe me understand and manage the cli pipelines and to serve as living documentation for the script pipelines - write out some markdown docuemntatoin in the docs/technical-specs folder and read claude.md

## Context

Created: 5/31/2025nt | 0 | Never used |
| classify-untyped | 0 | Never used |
| test-classify-document-types | 0 | Never used |
| test-connection | 0 | Never used |

### Key Findings

1. **Classification Features**:
   - Classification is already implemented using Claude service
   - Uses document_types table for classification targets
   - No complex AI summarization found - just classification
   - Classification commands exist but are rarely/never used

2. **Current Commands**:
   - `sync` - Syncs filesystem with doc_files table (removes deleted files)
   - `find-new` - Finds new markdown files and adds to database
   - `show-untyped` - Lists documents without document_type_id
   - `show-recent` - Lists recently modified documents
   - `classify-recent` - Classifies recent documents using Claude
   - `classify-untyped` - Classifies documents without types
   - `all` - Runs sync, find-new, and classify-recent in sequence

3. **No AI Summarization Found**:
   - No content extraction or summarization features detected
   - Only classification functionality exists
   - Some archived files suggest previous iterations had more complex features

4. **Service Architecture**:
   - Uses shared services pattern correctly
   - Singleton pattern for DocumentService
   - Proper use of SupabaseClientService singleton
   - Uses claudeService for AI classification
   - Good separation of concerns

### Recommendations for Simplification

1. **Keep Core Commands**:
   - `sync` - Essential for filesystem/database synchronization
   - `find-new` - Essential for discovering new documents
   - `classify-doc <path>` - New focused command for single document
   - `tag-doc <path> <tags>` - New command for manual tagging

2. **Archive/Remove**:
   - Test commands (test-classify-document-types, test-google-doc-classification)
   - Low-usage display commands (can be replaced with UI)

3. **New Commands Needed**:
   - `mark-important <path> <score>` - Set importance score
   - `enable-auto-update <path> <source>` - Enable auto-updates
   - `classify-all-untyped` - Batch classify all untyped documents

### Next Steps

1. Create database migration for doc_files enhancements
2. Simplify CLI commands to core functionality
3. Build new commands for importance scoring and auto-updates
4. Create integration with prompt-service for classification
5. Build UI components in dhg-admin-code