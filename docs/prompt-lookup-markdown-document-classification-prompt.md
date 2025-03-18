# Prompt Lookup: markdown-document-classification-prompt

Generated: 2025-03-18T00:54:37.961Z


=== PROMPT DETAILS FROM DATABASE ===
ID: 880480a9-3241-48f0-bb83-a93a81de8553
Name: markdown-document-classification-prompt
Description: No description
Created: 3/9/2025, 6:45:28 PM
Updated: 3/18/2025, 12:27:22 AM

=== PROMPT CONTENT FROM DATABASE ===
"# Document Classification and Assessment Prompt\n\nYou are an expert document manager on a development team tasked with classifying and assessing markdown documentation files. Your job is to analyze the provided markdown file and determine which document type it best matches, then create a detailed assessment of its quality, relevance, and recommended status.\n\n## Input Context\n\nYou'll be provided with:\n1. A markdown file to analyze\n2. A list of document types defined in your system\n3. Current development architecture documentation\n4. Optional metadata about existing files in the repository\n\n## Instructions\n\n1. Carefully read the markdown file content.\n2. Compare against the provided document types to determine the most appropriate classification.\n3. Assess the document's quality, relevance, and potential value.\n4. Generate appropriate tags that capture the document's key topics.\n5. Determine a recommended status (KEEP, UPDATE, ARCHIVE, DELETE).\n6. Structure your response in the specified JSON format.\n\nYour assessment should consider:\n- How well the document aligns with current development architecture\n- The document's creation/modification date and its recency\n- The document's completeness and adherence to documentation standards\n- The document's practical value to developers\n\n## Response Format\n\nProvide your assessment in the following JSON format:\n\n```json\n{\n  \"id\": \"{{auto-generated UUID}}\",\n  \"file_path\": \"{{file_path}}\",\n  \"title\": \"{{document title}}\",\n  \"summary\": {\n    \"brief\": \"{{brief summary of the document}}\",\n    \"detailed\": {\n      \"purpose\": \"{{document purpose}}\",\n      \"key_components\": \"{{main sections/elements}}\",\n      \"practical_application\": \"{{how the document would be used}}\"\n    }\n  },\n  \"ai_generated_tags\": [\"{{tag1}}\", \"{{tag2}}\", \"{{tag3}}\", \"{{tag4}}\", \"{{tag5}}\"],\n  \"manual_tags\": null,\n  \"last_modified_at\": \"{{last_modified_date if available}}\",\n  \"last_indexed_at\": \"{{current_datetime}}\",\n  \"file_hash\": \"{{file_hash if available}}\",\n  \"metadata\": {\n    \"size\": {{file_size_in_bytes}},\n    \"isPrompt\": false\n  },\n  \"created_at\": \"{{creation_date if available, otherwise current_datetime}}\",\n  \"updated_at\": \"{{current_datetime}}\",\n  \"is_deleted\": false,\n  \"document_type_id\": \"{{matched document type id or null if UNCLASSIFIED}}\",\n  \"ai_assessment\": {\n    \"document_type\": \"{{matched document type or 'UNCLASSIFIED'}}\",\n    \"current_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of current relevance score}}\"\n    },\n    \"potential_relevance\": {\n      \"score\": {{1-10 score}},\n      \"reasoning\": \"{{brief explanation of potential future relevance}}\"\n    },\n    \"status_recommendation\": \"{{KEEP|UPDATE|ARCHIVE|DELETE}}\",\n    \"confidence\": {{1-10 score}},\n    \"reasoning\": \"{{explanation of the overall assessment and recommendations}}\"\n  },\n  \"assessment_quality_score\": {{1-10 overall quality score}},\n  \"assessment_created_at\": \"{{current_datetime}}\",\n  \"assessment_updated_at\": \"{{current_datetime}}\",\n  \"assessment_model\": \"Claude 3.7 Sonnet\",\n  \"assessment_version\": 1,\n  \"assessment_date\": \"{{current_date}}\"\n}\n```\n\nIf the document doesn't match any predefined document types, explain why in your reasoning and classify as \"UNCLASSIFIED\".\n\nFor the status recommendation:\n- KEEP: Document is relevant, accurate, and valuable as-is\n- UPDATE: Document contains useful information but needs updates\n- ARCHIVE: Document has historical value but is no longer actively relevant\n- DELETE: Document has little or no value and should be removed\n\nScore definitions:\n- Current/Potential Relevance (1-10): How valuable the document is now/could be in future\n- Confidence (1-10): How confident you are in your assessment\n- Assessment Quality Score (1-10): Overall quality of your assessment\n\n## Example Workflow\n\nWhen analyzing a document, follow this general process:\n1. First understand the document's content and structure\n2. Compare against document types to find the best match\n3. Evaluate quality based on completeness, clarity, and accuracy\n4. Assess relevance to current development practices\n5. Generate meaningful tags based on content\n6. Make a status recommendation with supporting reasoning\n\nFor JSONB storage compatibility, ensure:\n- All JSON is properly formatted and validated\n- Nested objects are used for structured data\n- Text fields have reasonable length limitations\n- Date fields follow ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sss+00:00)\n- Numeric scores are integers in the specified ranges\n"

=== RELATIONSHIPS (2) ===

Relationship ID: 104cefb1-810f-49f1-97a1-90d23ed5012d
Type: reference
Asset Path: docs/documentation-files-report.md
Context: Provides the list of markdown files so the promot can extract the metadata about the file.
File Content (242 lines, 39797 bytes):
---
# Documentation Files Database Update Report

Generated: 3/11/2025, 9:36:18 PM

## Update Summary

### Statistics Before Update
- **Total records:** 168
- **Active records:** 124
- **Deleted records:** 44

### Statistics After Update
- **Total records:** 169
- **Active records:** 125
- **Deleted records:** 44

### Update Results
- **Files activated:** 0
- **Files marked as deleted:** 0
- **Files with metadata updated:** 1
- **Files unchanged:** 167
- **New files added:** 1
- **Update errors:** 0

### File Existence Check
- **Files that exist on disk:** 124
- **Files not found on disk:** 44
- **New files found:** 1

### Existing Files Processed
apps/dhg-hub-lovable/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2303 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
apps/dhg-improve-experts/CLAUDE_API_CALL_FIX.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6855 bytes | Created: 3/9/2025, 4:36:51 AM | Modified: 3/9/2025, 4:36:51 AM  
apps/dhg-improve-experts/CLAUDE_API_WORKFLOW.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 12062 bytes | Created: 3/8/2025, 4:17:53 AM | Modified: 3/8/2025, 4:17:53 AM  
apps/dhg-improve-experts/CLAUDE_SQL_FIX.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4456 bytes | Created: 3/8/2025, 4:30:14 AM | Modified: 3/8/2025, 4:30:14 AM  
apps/dhg-improve-experts/development-process-specification.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 10161 bytes | Created: 3/5/2025, 5:17:04 PM | Modified: 3/5/2025, 5:17:04 PM  
apps/dhg-improve-experts/docs/docs-organization.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3222 bytes | Created: 3/2/2025, 12:06:24 PM | Modified: 3/2/2025, 12:06:24 PM | 🔄 Possible move from: docs/docs-organization.md  
apps/dhg-improve-experts/docs/documentation-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4593 bytes | Created: 3/2/2025, 1:10:05 PM | Modified: 3/2/2025, 1:20:29 PM | 🔄 Possible move from: docs/documentation-report.md  
apps/dhg-improve-experts/docs/guts-dashboard.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4630 bytes | Created: 3/1/2025, 6:44:18 AM | Modified: 3/1/2025, 6:44:21 AM | 🔄 Possible move from: docs/guts-dashboard.md  
apps/dhg-improve-experts/docs/markdown-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1634 bytes | Created: 3/2/2025, 2:53:27 PM | Modified: 3/3/2025, 3:42:42 PM  
apps/dhg-improve-experts/docs/test-documentation.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2249 bytes | Created: 3/3/2025, 2:26:40 AM | Modified: 3/3/2025, 2:26:40 AM | 🔄 Possible move from: docs/test-documentation.md  
apps/dhg-improve-experts/DocumentTypeArchiveNotes.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2372 bytes | Created: 3/3/2025, 9:15:43 AM | Modified: 3/3/2025, 9:15:43 AM | 🔄 Possible move from: DocumentTypeArchiveNotes.md  
apps/dhg-improve-experts/experts-audit.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4895 bytes | Created: 2/28/2025, 6:48:48 AM | Modified: 2/28/2025, 6:48:48 AM | 🔄 Possible move from: docs/supabase_design/experts-audit.md, experts-audit.md  
apps/dhg-improve-experts/public/docs/prompts/document-classification-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4210 bytes | Created: 2/19/2025, 6:03:56 PM | Modified: 2/19/2025, 10:29:36 PM | 🔄 Possible move from: docs/prompts/document-classification-prompt.md, public/docs/prompts/document-classification-prompt.md  
apps/dhg-improve-experts/public/docs/prompts/expert-extraction-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2347 bytes | Created: 2/17/2025, 5:41:12 PM | Modified: 2/17/2025, 5:41:12 PM | 🔄 Possible move from: public/docs/prompts/expert-extraction-prompt.md  
apps/dhg-improve-experts/README-guts-dashboard.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4625 bytes | Created: 3/1/2025, 6:45:59 AM | Modified: 3/1/2025, 6:46:02 AM | 🔄 Possible move from: README-guts-dashboard.md  
apps/dhg-improve-experts/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2303 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
apps/dhg-improve-experts/scripts/cli/MIGRATION.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3133 bytes | Created: 3/10/2025, 9:18:09 PM | Modified: 3/10/2025, 9:18:09 PM  
apps/dhg-improve-experts/scripts/cli/PNPM-USAGE.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2304 bytes | Created: 3/11/2025, 6:32:29 AM | Modified: 3/11/2025, 6:36:38 AM  
apps/dhg-improve-experts/scripts/cli/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5550 bytes | Created: 3/10/2025, 9:17:35 PM | Modified: 3/11/2025, 8:38:13 AM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
apps/dhg-improve-experts/SQL_GENERATION_WORKFLOW.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 14131 bytes | Created: 3/8/2025, 4:22:05 AM | Modified: 3/8/2025, 4:22:05 AM  
apps/dhg-improve-experts/SUPABASE_CONNECTION.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3884 bytes | Created: 3/3/2025, 12:43:55 AM | Modified: 3/3/2025, 12:43:55 AM | 🔄 Possible move from: SUPABASE_CONNECTION.md  
apps/dhg-improve-experts/SUPABASE_TYPES_MIGRATION.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3707 bytes | Created: 3/3/2025, 12:35:53 AM | Modified: 3/3/2025, 12:35:53 AM | 🔄 Possible move from: SUPABASE_TYPES_MIGRATION.md  
CLAUDE.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1332 bytes | Created: 2/27/2025, 7:41:19 AM | Modified: 2/27/2025, 7:41:19 AM  
docs/ai-assets-validation-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 11537 bytes | Created: 3/9/2025, 5:57:26 PM | Modified: 3/9/2025, 6:46:30 PM  
docs/ai-processing/function-analysis.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 130 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/architecture/architecture-overview.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 169 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/architecture/claude_code_prompts.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 165 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/claude_code_prompts.md  
docs/architecture/doc-assessment-implementation.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 9269 bytes | Created: 3/5/2025, 5:24:14 PM | Modified: 3/5/2025, 5:24:14 PM  
docs/architecture/supabase_design/ai_columns_review.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4854 bytes | Created: 2/24/2025, 10:04:05 PM | Modified: 2/24/2025, 10:07:51 PM | 🔄 Possible move from: docs/supabase_design/ai_columns_review.md  
docs/architecture/supabase_design/ClassifyDocument_Explanation.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5547 bytes | Created: 2/27/2025, 7:46:32 AM | Modified: 2/27/2025, 7:46:32 AM | 🔄 Possible move from: docs/supabase_design/ClassifyDocument_Explanation.md  
docs/architecture/supabase_design/dashboard-function-inventory.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5692 bytes | Created: 2/28/2025, 1:25:06 PM | Modified: 2/28/2025, 1:25:55 PM | 🔄 Possible move from: docs/supabase_design/dashboard-function-inventory.md  
docs/architecture/supabase_design/database-functions.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 7609 bytes | Created: 2/28/2025, 6:17:06 AM | Modified: 2/28/2025, 6:17:06 AM | 🔄 Possible move from: docs/supabase_design/database-functions.md  
docs/architecture/supabase_design/dhg-presenter.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 23547 bytes | Created: 2/24/2025, 9:13:32 PM | Modified: 2/24/2025, 10:29:41 PM | 🔄 Possible move from: docs/supabase_design/dhg-presenter.md  
docs/architecture/supabase_design/experts-audit.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4895 bytes | Created: 2/28/2025, 6:51:13 AM | Modified: 2/28/2025, 6:51:13 AM | 🔄 Possible move from: docs/supabase_design/experts-audit.md, experts-audit.md  
docs/architecture/supabase_design/implementation_plan.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 28145 bytes | Created: 2/25/2025, 7:07:47 PM | Modified: 2/25/2025, 7:18:57 PM | 🔄 Possible move from: docs/supabase_design/implementation_plan.md  
docs/architecture/supabase_design/integration.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5383 bytes | Created: 2/28/2025, 6:14:58 AM | Modified: 2/28/2025, 6:14:58 AM | 🔄 Possible move from: docs/supabase_design/integration.md  
docs/architecture/supabase_design/key_project_files.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 22933 bytes | Created: 2/25/2025, 6:23:16 PM | Modified: 2/25/2025, 6:48:26 PM | 🔄 Possible move from: docs/supabase_design/key_project_files.md  
docs/architecture/supabase_design/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3649 bytes | Created: 2/28/2025, 6:15:35 AM | Modified: 2/28/2025, 6:15:35 AM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
docs/architecture/supabase_design/supabase_inconsistencies.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4689 bytes | Created: 2/25/2025, 7:41:48 PM | Modified: 2/25/2025, 7:43:51 PM | 🔄 Possible move from: docs/supabase_design/supabase_inconsistencies.md  
docs/architecture/supabase_design/supabase-manager-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6441 bytes | Created: 2/28/2025, 6:13:26 AM | Modified: 2/28/2025, 6:13:26 AM | 🔄 Possible move from: docs/supabase_design/supabase-manager-guide.md  
docs/architecture/system-design.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 153 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/authentication/google-auth.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 118 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/cli-workflow-pipeline.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 7086 bytes | Created: 3/11/2025, 4:26:00 PM | Modified: 3/11/2025, 4:26:00 PM  
docs/command-history-tracking.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5007 bytes | Created: 3/2/2025, 11:14:34 AM | Modified: 3/2/2025, 11:14:39 AM  
docs/components/Layout.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 134 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/components/SourceButtons.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 7756 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/components/UI_Components.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 148 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/database-connectivity-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1 bytes | Created: 3/9/2025, 3:09:18 PM | Modified: 3/9/2025, 3:09:18 PM  
docs/deployment/deployment-workflow.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4255 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/deployment/environment-setup.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2125 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/deployment/what-is-deployment.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 178 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/development/code-standards.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 124 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/development/file-management.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1452 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/development/testing.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 110 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/docs-organization.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 3222 bytes | Last Updated: 3/7/2025, 6:12:37 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/docs/docs-organization.md  
docs/documentation-files-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | → UPDATING METADATA | Size: 39654 bytes | Created: 3/9/2025, 12:12:42 PM | Modified: 3/11/2025, 8:35:12 PM  
docs/documentation-management.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4672 bytes | Created: 3/2/2025, 3:08:50 AM | Modified: 3/2/2025, 12:17:05 PM  
docs/documentation-report.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 4593 bytes | Last Updated: 3/7/2025, 6:12:37 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/docs/documentation-report.md  
docs/experts/expert-model.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 120 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/file-reader-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4458 bytes | Created: 3/9/2025, 1:24:44 PM | Modified: 3/9/2025, 1:24:44 PM  
docs/function-registry/registry-design.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 126 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/git-history/ai_processing_history.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 856 bytes | Created: 2/17/2025, 5:41:12 PM | Modified: 2/17/2025, 5:41:12 PM  
docs/git-history/ai_processing_with_patches.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 35566 bytes | Created: 2/17/2025, 5:41:12 PM | Modified: 2/17/2025, 5:41:12 PM  
docs/git-history/git_history_detailed.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 35558 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/git-history/git_history.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 11758 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/git-history/git_history_with_files.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 88786 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/git-workflows/restoring-previous-file-versions.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6307 bytes | Created: 3/8/2025, 1:58:05 PM | Modified: 3/9/2025, 5:41:19 PM  
docs/google-drive/sync-process.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 120 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/guides/batch-processing-and-trees.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6416 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/guides/file-entries-mapping.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3974 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/guides/supabase-connection_fixes.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 11081 bytes | Created: 2/23/2025, 9:54:01 AM | Modified: 2/23/2025, 10:14:03 AM  
docs/guides/using-supabase-views.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4601 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/guts-dashboard.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 4630 bytes | Last Updated: 3/7/2025, 6:12:38 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/docs/guts-dashboard.md  
docs/markdown-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 16564 bytes | Created: 3/9/2025, 8:54:17 AM | Modified: 3/11/2025, 8:23:29 PM  
docs/migrations/api-drive-supa.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6164 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/migrations/google-drive-integration.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 15453 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/migrations/migration_management.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4232 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/migrations/source_expert_google_design.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 28546 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/migrations/table-structure.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 8155 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/pages/document-classification.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5583 bytes | Created: 2/20/2025, 8:05:42 PM | Modified: 2/20/2025, 8:05:54 PM  
docs/pdf-processing/extraction.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 116 bytes | Last Updated: 3/7/2025, 5:12:02 PM  
docs/project-structure/adding-new-apps.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 938 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/anatomy-of-a-button.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5059 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/architecture-comparison.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4446 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/backup-restore-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3780 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/batch-processing.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3626 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/config-management.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3038 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/content-extraction_flow.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 701 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/dhg-improve-experts-structure.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 18257 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/environment-setup.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2125 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/monorepo-layout.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2997 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/pnpm-commands.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2902 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/shared-packages-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4634 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/supabase-functions.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4385 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/supabase-interactions.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 7307 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/supabase_types.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2571 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/project-structure/vite-configuration-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5301 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/project-structure/vite-setup.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1345 bytes | Created: 2/10/2025, 5:31:12 PM | Modified: 2/10/2025, 5:31:12 PM  
docs/prompts/code-analysis-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 157 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/code-analysis-prompt.md  
docs/prompts/document-classification-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 177 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/public/docs/prompts/document-classification-prompt.md, prompts/document-classification-prompt.md  
docs/prompts/document-type-analysis.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 161 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/document-type-analysis.md  
docs/prompts/document-type-integration-guide.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 179 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/document-type-integration-guide.md  
docs/prompts/expert-profiles.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 147 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/expert-profiles.md  
docs/prompts/react-component-analysis-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 179 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/react-component-analysis-prompt.md  
docs/python-ai-services-technical-spec.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 29740 bytes | Created: 3/10/2025, 9:07:01 PM | Modified: 3/10/2025, 9:07:06 PM  
docs/scripting/shell-scripting-basics.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4287 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/script-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 8809 bytes | Created: 3/8/2025, 2:38:25 PM | Modified: 3/9/2025, 11:56:36 AM  
docs/simple-db-results.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 312 bytes | Created: 3/8/2025, 3:40:51 PM | Modified: 3/8/2025, 3:40:51 PM  
docs/supabase_design/ai_columns_review.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 169 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/ai_columns_review.md  
docs/supabase_design/ClassifyDocument_Explanation.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 191 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/ClassifyDocument_Explanation.md  
docs/supabase_design/dashboard-function-inventory.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 191 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/dashboard-function-inventory.md  
docs/supabase_design/database-functions.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 171 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/database-functions.md  
docs/supabase_design/dhg-presenter.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 161 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/dhg-presenter.md  
docs/supabase_design/experts-audit.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 161 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/experts-audit.md, docs/architecture/supabase_design/experts-audit.md  
docs/supabase_design/implementation_plan.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 173 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/implementation_plan.md  
docs/supabase_design/integration.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 157 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/integration.md  
docs/supabase_design/key_project_files.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 169 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/key_project_files.md  
docs/supabase_design/README.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 147 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: apps/dhg-hub-lovable/README.md, apps/dhg-improve-experts/README.md, apps/dhg-improve-experts/scripts/cli/README.md, docs/architecture/supabase_design/README.md, file_types/registry_archives/pdf-research-portal/README.md, scripts/whisper/.venv-whisper/lib/python3.11/site-packages/torchgen/packaged/autograd/README.md, supabase/types/README.md  
docs/supabase_design/supabase_inconsistencies.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 183 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/supabase_inconsistencies.md  
docs/supabase_design/supabase-manager-guide.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 179 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: docs/architecture/supabase_design/supabase-manager-guide.md  
docs/test-documentation.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 2249 bytes | Last Updated: 3/7/2025, 6:12:39 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/docs/test-documentation.md  
docs/troubleshooting/component-integration.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2136 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/typescript-cli-technical-spec.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 12053 bytes | Created: 3/10/2025, 8:55:18 PM | Modified: 3/10/2025, 8:55:22 PM  
docs/utils/ai-processing.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5779 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/utils/google-drive.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5938 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
docs/utils/sync-file-metadata.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4362 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM  
DocumentTypeArchiveNotes.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 2372 bytes | Last Updated: 3/7/2025, 6:12:29 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/DocumentTypeArchiveNotes.md  
experts-audit.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 4895 bytes | Last Updated: 3/7/2025, 6:12:33 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/experts-audit.md, docs/architecture/supabase_design/experts-audit.md  
file_types/registry_archives/pdf-research-portal/docs/commit-details.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2632 bytes | Created: 3/6/2025, 9:46:19 PM | Modified: 3/6/2025, 9:46:19 PM  
file_types/registry_archives/pdf-research-portal/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1039 bytes | Created: 3/6/2025, 9:46:19 PM | Modified: 3/6/2025, 9:46:19 PM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
file_types/registry_archives/pdf_working/google-drive-integration.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1696 bytes | Created: 3/6/2025, 9:46:19 PM | Modified: 3/6/2025, 9:46:19 PM  
prompts/claude_code_prompts.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4262 bytes | Created: 2/28/2025, 5:46:19 AM | Modified: 3/1/2025, 5:13:28 AM | 🔄 Possible move from: docs/architecture/claude_code_prompts.md  
prompts/code-analysis-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5270 bytes | Created: 2/20/2025, 7:40:16 PM | Modified: 2/20/2025, 9:28:20 PM | 🔄 Possible move from: docs/prompts/code-analysis-prompt.md  
prompts/development-process-specification.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 10131 bytes | Created: 3/5/2025, 5:14:27 PM | Modified: 3/5/2025, 5:14:27 PM  
prompts/doc-assessment-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3081 bytes | Created: 3/5/2025, 5:23:25 PM | Modified: 3/5/2025, 5:23:25 PM  
prompts/document-classification-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2899 bytes | Created: 2/19/2025, 5:38:21 PM | Modified: 2/19/2025, 5:38:21 PM | 🔄 Possible move from: docs/prompts/document-classification-prompt.md, public/docs/prompts/document-classification-prompt.md  
prompts/document-type-analysis.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 8410 bytes | Created: 2/19/2025, 5:38:12 PM | Modified: 2/19/2025, 5:38:12 PM | 🔄 Possible move from: docs/prompts/document-type-analysis.md  
prompts/document-type-integration-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4473 bytes | Created: 2/19/2025, 5:38:33 PM | Modified: 2/19/2025, 5:38:33 PM | 🔄 Possible move from: docs/prompts/document-type-integration-guide.md  
prompts/document-type-request-template.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1512 bytes | Created: 3/6/2025, 5:36:31 PM | Modified: 3/6/2025, 5:36:31 PM  
prompts/enhanced-analysis-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 11487 bytes | Created: 2/21/2025, 6:48:35 PM | Modified: 2/21/2025, 6:48:35 PM | 🔄 Possible move from: public/prompts/enhanced-analysis-prompt.md  
prompts/expert-extraction-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2347 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM | 🔄 Possible move from: public/docs/prompts/expert-extraction-prompt.md  
prompts/expert-profiles.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5851 bytes | Created: 2/17/2025, 5:41:13 PM | Modified: 2/17/2025, 5:41:13 PM | 🔄 Possible move from: docs/prompts/expert-profiles.md  
prompts/markdown-document-classification-prompt copy.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4013 bytes | Created: 3/9/2025, 11:44:22 AM | Modified: 3/9/2025, 11:44:22 AM  
prompts/markdown-document-classification-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 4504 bytes | Created: 3/11/2025, 8:32:46 AM | Modified: 3/11/2025, 8:32:46 AM  
prompts/prompt-management-implementation-plan.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 10422 bytes | Created: 3/6/2025, 5:25:15 PM | Modified: 3/6/2025, 5:25:15 PM  
prompts/react-component-analysis-prompt.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5990 bytes | Created: 2/21/2025, 6:48:24 PM | Modified: 2/21/2025, 10:08:14 PM | 🔄 Possible move from: docs/prompts/react-component-analysis-prompt.md  
prompts/sql-history-implementation-plan.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 18388 bytes | Created: 3/6/2025, 11:35:35 PM | Modified: 3/6/2025, 11:35:35 PM  
prompts/sql-query-generation-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3488 bytes | Created: 3/8/2025, 2:57:01 AM | Modified: 3/8/2025, 2:57:01 AM  
prompts/supabase-sql-query-guide.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1 bytes | Created: 3/9/2025, 3:09:18 PM | Modified: 3/9/2025, 3:09:18 PM  
public/docs/prompts/document-classification-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 4210 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/public/docs/prompts/document-classification-prompt.md, prompts/document-classification-prompt.md  
public/docs/prompts/expert-extraction-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 2347 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/public/docs/prompts/expert-extraction-prompt.md, prompts/expert-extraction-prompt.md  
public/prompts/enhanced-analysis-prompt.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 873 bytes | Last Updated: 3/7/2025, 5:12:02 PM | 🔄 Possibly moved to: prompts/enhanced-analysis-prompt.md  
README-guts-dashboard.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 4625 bytes | Last Updated: 3/7/2025, 6:12:30 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/README-guts-dashboard.md  
README.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 2303 bytes | Last Updated: 3/7/2025, 6:12:31 PM | 🔄 Possibly moved to: apps/dhg-hub-lovable/README.md, apps/dhg-improve-experts/README.md, apps/dhg-improve-experts/scripts/cli/README.md, docs/architecture/supabase_design/README.md, file_types/registry_archives/pdf-research-portal/README.md, scripts/whisper/.venv-whisper/lib/python3.11/site-packages/torchgen/packaged/autograd/README.md, supabase/types/README.md  
scripts/docs/markdown-report.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 733 bytes | Created: 3/9/2025, 8:54:42 AM | Modified: 3/9/2025, 8:54:42 AM  
scripts/README-db-functions.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 7808 bytes | Created: 3/2/2025, 3:31:12 PM | Modified: 3/5/2025, 8:01:15 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/huggingface_hub/templates/datasetcard_template.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 5503 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/huggingface_hub/templates/modelcard_template.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6870 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/numpy/random/LICENSE.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3511 bytes | Created: 2/22/2025, 6:45:48 PM | Modified: 2/22/2025, 6:45:48 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/onnxruntime/Privacy.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2469 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/onnxruntime/tools/mobile_helpers/coreml_supported_mlprogram_ops.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2006 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/onnxruntime/tools/mobile_helpers/coreml_supported_neuralnetwork_ops.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 1915 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/onnxruntime/tools/mobile_helpers/nnapi_supported_ops.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 2327 bytes | Created: 2/22/2025, 5:38:59 PM | Modified: 2/22/2025, 5:38:59 PM  
scripts/whisper/.venv-whisper/lib/python3.11/site-packages/torchgen/packaged/autograd/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 147 bytes | Created: 2/22/2025, 6:34:23 PM | Modified: 2/22/2025, 6:34:23 PM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  
SUPABASE_CONNECTION.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 3884 bytes | Last Updated: 3/7/2025, 6:12:32 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/SUPABASE_CONNECTION.md  
supabase-types-analysis.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 6171 bytes | Created: 3/1/2025, 9:35:51 AM | Modified: 3/5/2025, 8:01:14 PM  
SUPABASE_TYPES_MIGRATION.md | ❌ NOT FOUND | Before: DELETED | After: DELETED | (no change) | Size: 3707 bytes | Last Updated: 3/7/2025, 6:12:33 PM | 🔄 Possibly moved to: apps/dhg-improve-experts/SUPABASE_TYPES_MIGRATION.md  
supabase/types/README.md | ✅ EXISTS | Before: ACTIVE | After: ACTIVE | (no change) | Size: 3853 bytes | Created: 3/1/2025, 9:37:09 AM | Modified: 3/5/2025, 8:01:15 PM | 🔄 Possible move from: docs/supabase_design/README.md, README.md  

### New Files Added
docs/batch-processing-technical-spec.md | ✨ NEW FILE | Size: 17019 bytes | Created: 3/11/2025, 8:54:10 PM | Modified: 3/11/2025, 8:54:15 PM  

## Claude API Test Results

**Status:** ✅ SUCCESS  
**Message:** Claude API test successful

### Claude API Response:

# Analysis of documentation_files Table

Without specific details about your current documentation_files table structure, I'll provide a general analysis of common issues and best practices for documentation management in a monorepo.

## Common Issues with Documentation Files in Databases
- Inconsistent metadata tracking (creation dates, authors, versions)
- Poor organization leading to duplicate or outdated files
- Lack of clear relationships between code and corresponding documentation
- Insufficient versioning to match documentation with code releases

## Best Practices for Documentation in a Monorepo

### 1. Implement a Consistent Directory Structure
**Recommendation:** Create a standardized documentation hierarchy that mirrors your code structure.
- Place documentation close to the code it describes (e.g., `/src/module/docs/`)
- Maintain a central index in a `/docs` directory with cross-references
- Use consistent naming conventions (e.g., `component-name.md`, `api-reference.md`)

### 2. Establish Documentation Versioning Strategy
**Recommendation:** Align documentation versions with code releases.
- Tag documentation with the same version numbers as code releases
- Implement a documentation changelog to track significant updates
- Consider using a documentation versioning tool like Docusaurus or MkDocs
- Store version metadata in your documentation_files table to enable filtering

### 3. Automate Documentation Testing an

## Next Steps

1. Run the script periodically to keep the database in sync with files on disk
2. Use the documentation_files table to power your markdown viewer
3. Consider implementing a file move detection system to track file relocations

---

Relationship ID: 104d308d-2197-4301-9b60-52972730e19c
Type: reference
Asset Path: prompts/development-process-specification.md
Context: Provides the core evaluation material to help the prompt evauate the value of the particular file being analyzed in relation to the goals defibned in the tech specification
File Content (228 lines, 10131 bytes):
---
# DHG Development Process Specification

## Overview

This document outlines the design, build, and iteration process for the DHG application ecosystem. It serves as a reference for development practices, architectural decisions, and technical dependencies. This specification can be used to evaluate existing documentation against current development practices to identify gaps and prioritize documentation efforts.

## Development Paradigm

Our development approach follows a pragmatic, component-based methodology focused on rapid iteration and functional deliverables. Key aspects include:

1. **Component-First Development**: Building discrete, reusable UI components that can be composed into complex interfaces
2. **Debug-Driven Development**: Implementing extensive debugging capabilities throughout components to aid in development
3. **Incremental Enhancement**: Starting with minimal viable functionality and iteratively enhancing based on feedback
4. **Documentation Through Demonstration**: Creating working examples that serve as both development artifacts and documentation

## Technical Stack

### Frontend

- **Framework**: React with functional components and hooks
- **Bundling**: Vite for fast builds and hot module replacement
- **Styling**: Tailwind CSS for utility-first styling approach
- **State Management**: React hooks (useState, useContext) for local and shared state
- **Routing**: React Router for client-side navigation
- **Component Library**: Custom components based on shadcn/ui primitives

### Backend

- **Database**: Supabase (PostgreSQL) for data storage and retrieval
- **Authentication**: Supabase Auth for user authentication
- **API**: RESTful endpoints via Supabase functions
- **Storage**: Supabase Storage for file storage
- **Functions**: Edge Functions for serverless compute

### Integration

- **Google Drive**: Integration for document synchronization and metadata extraction
- **OpenAI**: AI processing for document analysis and content extraction
- **Claude**: Advanced text analysis and context-aware processing

### Development Tools

- **Package Management**: pnpm for efficient dependency management in monorepo structure
- **Monorepo**: Workspace-based organization of multiple applications
- **TypeScript**: Static typing for improved development experience and error prevention
- **ESLint/Prettier**: Code style enforcement and formatting
- **Git**: Version control with feature branch workflow

## Design and Build Process

### 1. Component Design

1. **Initial Specification**: Define the component's purpose, inputs, outputs, and expected behavior
2. **Prototype Development**: Create a minimal implementation with essential functionality
3. **Debug Integration**: Add debug panels, logging, and state visualization
4. **Edge Case Handling**: Implement error states, loading states, and empty states

### 2. Page Assembly

1. **Layout Design**: Define the page structure and component arrangement
2. **Component Integration**: Assemble components with appropriate data flow
3. **State Management**: Implement state sharing between components as needed
4. **Navigation Flow**: Define and implement navigation between pages

### 3. Data Integration

1. **Schema Definition**: Define database schema for required entities
2. **Query Implementation**: Create typed queries for data retrieval
3. **Mutation Implementation**: Implement data modification operations
4. **Caching Strategy**: Define appropriate caching mechanisms for improved performance

### 4. External Integrations

1. **Authentication Flow**: Implement user authentication and session management
2. **Google Drive Integration**: Set up synchronization with document sources
3. **AI Processing Flow**: Implement pipelines for document analysis and content extraction
4. **Metadata Synchronization**: Maintain consistency between external data and local storage

### 5. Testing and Validation

1. **Component Testing**: Verify component behavior in isolation
2. **Integration Testing**: Validate interactions between components
3. **User Flow Testing**: Ensure complete user journeys function as expected
4. **Performance Validation**: Check for performance bottlenecks and optimize as needed

### 6. Iteration and Refinement

1. **Feedback Collection**: Gather user feedback on implemented features
2. **Issue Identification**: Document bugs, edge cases, and limitations
3. **Enhancement Planning**: Prioritize improvements based on impact and effort
4. **Implementation Cycle**: Apply changes in small, focused iterations

## File and Directory Structure

### Monorepo Organization

```
dhg-mono/
├── apps/
│   └── dhg-improve-experts/  # Main application
├── docs/                    # Documentation
├── packages/                # Shared libraries
└── supabase/               # Database definitions
```

### Application Structure

```
dhg-improve-experts/
├── public/                 # Static assets
├── src/
│   ├── api/                # API endpoints
│   ├── app/                # Application-specific code
│   ├── components/         # Reusable UI components
│   ├── config/             # Configuration constants
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # External service integrations
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   ├── schemas/            # Data validation schemas
│   ├── services/           # Service abstractions
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions and helpers
└── tests/                  # Test files
```

## Component Taxonomy

### UI Components

- **Layout Components**: Page structure, navigation, and content organization
- **Form Components**: User input collection and validation
- **Display Components**: Data visualization and presentation
- **Interactive Components**: User interaction and feedback

### Functional Components

- **Data Fetching**: API integration and data retrieval
- **State Management**: Application state handling
- **Authentication**: User identity and access control
- **Processing**: Data transformation and analysis

### Integration Components

- **Google Drive**: Document synchronization and retrieval
- **AI Processing**: Content analysis and extraction
- **Batch Processing**: Background task management
- **Notification**: User alerting and feedback

## Development Practices

### Code Organization

- **Component Modularity**: Each component should have a single responsibility
- **Typed Interfaces**: All component props and state should be typed
- **Consistent Naming**: Follow established naming conventions
- **Archival Practice**: Deprecated code is archived with date suffixes (Component.YYYY-MM-DD.tsx)

### Styling Approach

- **Utility-First**: Prefer Tailwind utility classes for styling
- **Component Variants**: Use variants for component state variations
- **Responsive Design**: Implement mobile-first responsive layouts
- **Accessibility**: Ensure proper contrast, keyboard navigation, and screen reader support

### State Management

- **Local State**: Use useState for component-specific state
- **Shared State**: Use useContext for cross-component state sharing
- **API State**: Use SWR or React Query for server state management
- **Form State**: Use controlled components for form inputs

### Error Handling

- **Graceful Degradation**: Components should handle error states elegantly
- **User Feedback**: Provide clear error messages to users
- **Logging**: Log errors for debugging purposes
- **Recovery**: Implement retry mechanisms where appropriate

## Documentation Standards

### Component Documentation

- **Purpose**: Clear description of the component's role
- **Props**: Complete documentation of all props and their types
- **Example Usage**: Concrete examples of component implementation
- **Edge Cases**: Description of how edge cases are handled

### API Documentation

- **Endpoints**: List of all available endpoints
- **Parameters**: Required and optional parameters
- **Response Format**: Expected response structure
- **Error Handling**: Possible error states and codes

### Integration Documentation

- **Setup Requirements**: Prerequisites for integration
- **Authentication**: Authentication flow details
- **Data Flow**: Description of data exchange
- **Limitations**: Known limitations and constraints

## Evaluation Criteria

This specification can be used to evaluate existing documentation against the following criteria:

1. **Completeness**: Does the documentation cover all aspects of the development process?
2. **Accuracy**: Is the documentation aligned with current practices?
3. **Clarity**: Is the documentation easy to understand and follow?
4. **Actionability**: Does the documentation provide clear guidance for implementation?
5. **Maintenance**: Is the documentation up-to-date and regularly maintained?

## Implementation Examples

The following recent implementations exemplify our development approach:

1. **Viewer2**: Enhanced file browser with root folder filtering and hierarchical display
2. **FileTree2**: Specialized tree component with expanded debugging capabilities
3. **BatchProcessing**: Background task management with status monitoring
4. **DocumentExtraction**: AI-powered content analysis and extraction
5. **GoogleDriveSync**: External content synchronization and metadata management

## Conclusion

This specification describes our current development process, emphasizing component-based design, incremental enhancement, and extensive debugging capabilities. By evaluating existing documentation against this specification, we can identify gaps and prioritize documentation efforts to better support ongoing development.

Documentation should focus on providing practical guidance, code examples, and clear explanations of design decisions to facilitate both current development and future maintenance.
---

=== PROMPT METADATA ===
{
  "hash": "JTIzJTIwRG9jdW1lbnQlMjBDbGFzc2lmaWNhdGlv",
  "usage": {
    "inputSchema": {},
    "outputSchema": "text"
  },
  "source": {
    "gitInfo": {
      "branch": "main",
      "commitId": "none"
    },
    "fileName": "markdown-document-classification-prompt.md",
    "createdAt": "2025-03-09T18:45:28.401Z",
    "lastModified": "2025-03-11T15:34:43.423Z"
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
  "databaseQuery": "select * from document_types where category = 'Documentation';",
  "relatedAssets": [
    "667ae774-15df-4657-ab13-925e1b613f97",
    "40f9d0d9-029b-4e42-a37b-d8c1cf0d5a89"
  ],
  "packageJsonFiles": []
}

=== DATABASE QUERY RESULTS ===
Query: select * from document_types where category = 'Documentation';
Executing query: select * from document_types where category = 'Documentation';
Detected Documentation category query - using direct table access
Found 8 records with category=Documentation
Records found: 8
[
  {
    "id": "73ee8695-2750-453f-ad6a-929a6b64bc74",
    "document_type": "README",
    "current_num_of_type": 0,
    "description": "A markdown document that serves as the primary introduction and documentation for a project or repository. It typically contains project overview, installation instructions, usage examples, and contribution guidelines.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:41:42.719+00:00",
    "updated_at": "2025-03-09T11:41:42.719+00:00",
    "required_fields": [
      "title",
      "project_description",
      "installation_section"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analyzers": {
        "clarity_assessment": {
          "output": "qualitative evaluation",
          "description": "Assess how clear and understandable the instructions are"
        },
        "completeness_score": {
          "output": "score 0-100",
          "description": "Evaluate how complete the README is based on presence of key sections"
        }
      },
      "extractors": {
        "dependencies": {
          "format": "array",
          "description": "Identify and list any dependencies mentioned in installation instructions"
        },
        "code_examples": {
          "format": "array",
          "description": "Extract code examples for indexing and reference"
        },
        "project_summary": {
          "max_length": 200,
          "description": "Extract a concise summary of the project's purpose and features"
        }
      },
      "generators": {
        "table_of_contents": {
          "trigger": "missing_toc",
          "description": "Generate a table of contents based on headings if not present"
        },
        "improvement_suggestions": {
          "trigger": "low_clarity_score",
          "description": "Suggest improvements for unclear sections or missing information"
        }
      }
    },
    "validation_rules": {
      "max_length": 50000,
      "min_length": 300,
      "required_sections": [
        "Introduction/Overview",
        "Installation",
        "Usage"
      ],
      "markdown_validation": {
        "require_headings": true,
        "max_heading_depth": 4,
        "require_code_blocks": false
      }
    }
  },
  {
    "id": "e54ebd13-79d1-4fe2-93db-6f25c9b6a9d0",
    "document_type": "Deployment Environment Guide",
    "current_num_of_type": 0,
    "description": "Comprehensive documentation for managing project deployment processes, environment configurations, and deployment workflows across different stages (development, staging, production).",
    "mime_type": "[\"text/markdown\",\"application/pdf\",\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"]",
    "file_extension": "[\"md\",\"pdf\",\"docx\"]",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:50:15.504+00:00",
    "updated_at": "2025-03-09T11:50:15.504+00:00",
    "required_fields": [
      "title",
      "environment_types",
      "deployment_process",
      "configuration_details",
      "prerequisites"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "generate_summary": "Create an executive summary of the deployment process for quick reference",
      "suggest_improvements": "Analyze the deployment process and suggest optimizations based on best practices",
      "detect_security_risks": "Flag potential security issues in the deployment process",
      "version_compatibility": "Identify software version dependencies and potential compatibility issues",
      "identify_deployment_commands": "Extract all deployment commands and scripts for automation purposes",
      "extract_environment_variables": "Identify and list all environment variables mentioned in the document"
    },
    "validation_rules": {
      "environment_types": "Must include at least development and production environments",
      "deployment_process": "Must contain step-by-step instructions with command examples",
      "configuration_details": "Must include environment variables and configuration file locations",
      "security_considerations": "Should include access control and credential management information"
    }
  },
  {
    "id": "3e00c51b-acad-457a-b3b9-cdd3b6f15a4f",
    "document_type": "Git Repository Journal",
    "current_num_of_type": 0,
    "description": "A structured log for tracking Git operations, commit history, and command reference for a repository. Helps developers document what was checked in, when changes occurred, and which Git commands to use for specific situations.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:52:53.145+00:00",
    "updated_at": "2025-03-09T11:52:53.145+00:00",
    "required_fields": [
      "repository_name",
      "entries"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "analysis": {
        "command_usage": "Analyze command usage to recommend more efficient alternatives",
        "commit_patterns": "Identify patterns in commit frequency and types",
        "workflow_optimization": "Suggest improvements to Git workflow based on journal entries"
      },
      "extraction": {
        "from_git_log": "Parse `git log` output to automatically populate entries",
        "from_git_status": "Extract current repository status information"
      },
      "generation": {
        "explanations": "Provide clear explanations for complex Git operations",
        "best_practices": "Generate best practices for common Git workflows based on repository activity patterns",
        "command_suggestions": "Suggest appropriate Git commands based on described scenarios"
      }
    },
    "validation_rules": {
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "date",
            "action_type",
            "description"
          ],
          "properties": {
            "date": {
              "type": "string",
              "format": "date-time"
            },
            "action_type": {
              "enum": [
                "commit",
                "merge",
                "branch",
                "rebase",
                "pull",
                "push",
                "tag",
                "other"
              ],
              "type": "string"
            },
            "branch_name": {
              "type": "string"
            },
            "commit_hash": {
              "type": "string",
              "pattern": "^[0-9a-f]{7,40}$",
              "required_if": {
                "action_type": [
                  "commit",
                  "merge"
                ]
              }
            },
            "description": {
              "type": "string",
              "min_length": 5
            },
            "commands_used": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "notes": {
                    "type": "string"
                  },
                  "command": {
                    "type": "string"
                  },
                  "purpose": {
                    "type": "string"
                  }
                }
              }
            },
            "files_changed": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "min_items": 1
      },
      "best_practices": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "scenario": {
              "type": "string"
            },
            "explanation": {
              "type": "string"
            },
            "recommended_commands": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        }
      },
      "repository_name": {
        "type": "string",
        "max_length": 100,
        "min_length": 1
      }
    }
  },
  {
    "id": "e9d3e473-5315-4837-9f5f-61f150cbd137",
    "document_type": "Code Documentation Markdown",
    "current_num_of_type": 0,
    "description": "Markdown files specifically for documenting project code, including function descriptions, parameter details, usage examples, and implementation notes.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-07T06:36:28.847+00:00",
    "updated_at": "2025-03-09T11:43:03.896+00:00",
    "required_fields": [
      "title",
      "description",
      "module_or_class_reference"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "linking": {
        "link_to_dependency_docs": true,
        "identify_cross_references": true,
        "suggest_related_documentation": true
      },
      "analysis": {
        "complexity_assessment": true,
        "documentation_coverage": true,
        "api_stability_indicators": true
      },
      "extraction": {
        "detect_code_examples": true,
        "identify_dependencies": true,
        "extract_parameter_types": true,
        "identify_functions_and_methods": true
      },
      "enhancement": {
        "verify_example_validity": true,
        "generate_missing_examples": false,
        "suggest_missing_documentation": true,
        "check_documentation_completeness": true
      }
    },
    "validation_rules": {
      "links": {
        "internal_links_must_be_valid": true,
        "external_links_must_be_labeled": true
      },
      "content": {
        "max_heading_depth": 4,
        "must_include_code_examples": true,
        "must_have_function_descriptions": true
      },
      "structure": {
        "min_sections": 3,
        "must_have_heading": true,
        "required_sections": [
          "Overview",
          "Usage",
          "API Reference"
        ]
      }
    }
  },
  {
    "id": "adbe8042-dcc4-4402-977a-1fa04688945d",
    "document_type": "Technical Specification",
    "current_num_of_type": 0,
    "description": "Structured markdown documentation that describes software specifications, implementation details, and coding guidelines to facilitate AI-assisted code generation.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:46:09.967+00:00",
    "updated_at": "2025-03-09T11:46:09.967+00:00",
    "required_fields": [
      "title",
      "overview",
      "requirements",
      "implementation_guidelines"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "code_extraction": {
        "validate_syntax": true,
        "identify_languages": true,
        "extract_code_blocks": true
      },
      "requirement_analysis": {
        "detect_ambiguities": true,
        "identify_functional_requirements": true,
        "identify_non_functional_requirements": true
      },
      "code_generation_hints": {
        "identify_return_values": true,
        "extract_parameter_types": true,
        "detect_error_handling_requirements": true
      },
      "implementation_guidance": {
        "detect_technology_stack": true,
        "extract_design_patterns": true,
        "identify_architecture_components": true
      }
    },
    "validation_rules": {
      "max_length": 50000,
      "min_length": 500,
      "content_checks": {
        "code_blocks_present": true,
        "technical_specificity": "high"
      },
      "required_sections": [
        "# Overview",
        "# Requirements",
        "# Implementation Guidelines"
      ],
      "recommended_sections": [
        "# API Specifications",
        "# Code Examples",
        "# Testing Strategy",
        "# Performance Considerations"
      ]
    }
  },
  {
    "id": "c903f553-baf2-482b-bfc9-bade16d683d1",
    "document_type": "External Library Documentation",
    "current_num_of_type": 0,
    "description": "Markdown documentation files that describe external libraries, frameworks, or APIs. These documents contain explanations, usage examples, and reference information for third-party code that is used within projects but not developed internally.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-15T20:54:39.943+00:00",
    "updated_at": "2025-03-15T20:54:39.943+00:00",
    "required_fields": [
      "library_name",
      "version",
      "purpose",
      "main_features"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "detect_api_changes": true,
      "identify_dependencies": true,
      "suggest_usage_patterns": true,
      "extract_library_details": true,
      "tag_relevant_technologies": true,
      "highlight_breaking_changes": true,
      "generate_comparison_with_alternatives": false
    },
    "validation_rules": {
      "max_heading_depth": 4,
      "must_contain_code_examples": true,
      "must_reference_external_source": true,
      "must_include_version_information": true,
      "should_include_installation_section": true
    }
  },
  {
    "id": "ad9336a0-613f-4632-906b-b691dc39c7df",
    "document_type": "Solution Guide",
    "current_num_of_type": 0,
    "description": "Structured markdown files documenting specific coding fixes, workarounds, and solutions that have been verified to work. These guides help the AI learn from past successes when facing similar technical challenges.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:48:10.007+00:00",
    "updated_at": "2025-03-09T11:48:10.007+00:00",
    "required_fields": [
      "title",
      "problem_statement",
      "solution_approach",
      "code_examples",
      "verification_method"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "extract_error_patterns": true,
      "categorize_by_root_cause": true,
      "link_to_related_solutions": true,
      "identify_solution_patterns": true,
      "index_for_similarity_search": true,
      "extract_programming_concepts": true
    },
    "validation_rules": {
      "max_length": 10000,
      "min_length": 200,
      "must_contain_code_block": true,
      "must_include_verification": true,
      "must_have_problem_solution_structure": true
    }
  },
  {
    "id": "50c810a3-c4a6-4243-a7a4-6381eb42e0a3",
    "document_type": "Script Report",
    "current_num_of_type": 0,
    "description": "A markdown document that contains both script output/results and documentation of the script development process itself. These documents serve as living artifacts that capture both the technical findings and the evolution of the script's development.",
    "mime_type": "text/markdown",
    "file_extension": "md",
    "document_type_counts": 0,
    "category": "Documentation",
    "created_at": "2025-03-09T11:55:50.863+00:00",
    "updated_at": "2025-03-09T11:55:50.863+00:00",
    "required_fields": [
      "title",
      "script_purpose",
      "development_notes",
      "output_results"
    ],
    "legacy_document_type_id": null,
    "is_ai_generated": true,
    "content_schema": null,
    "ai_processing_rules": {
      "extract_metrics": {
        "action": "data_extraction",
        "description": "Identify and extract quantitative metrics or results from the output section"
      },
      "summarize_findings": {
        "action": "text_summarization",
        "description": "Create a concise summary of the script's key findings or outputs"
      },
      "extract_code_blocks": {
        "action": "extract_structured_data",
        "description": "Identify and extract all code blocks with their language specification"
      },
      "suggest_improvements": {
        "action": "recommendation_generation",
        "description": "Based on development notes and results, suggest potential improvements to the script"
      },
      "identify_development_stages": {
        "action": "semantic_classification",
        "description": "Analyze development notes to identify distinct stages of script evolution"
      }
    },
    "validation_rules": {
      "max_size_mb": 10,
      "min_sections": 3,
      "must_include_code_blocks": true,
      "must_have_results_section": true,
      "must_have_development_section": true
    }
  }
]

=== PACKAGE.JSON FILES ===
