# DocumentService Archive Notes

## Archived Date: 2025-06-14

## Original Location
- Primary: `/scripts/cli-pipeline/shared/services/document-service.ts`

## Related Files Found During Migration
Multiple DocumentService implementations were discovered:
1. `/scripts/cli-pipeline/shared/services/document-service.ts` - **This one was refactored**
2. `/scripts/cli-pipeline/document/services/document-service.ts` - Different service for document pipeline
3. `/scripts/cli-pipeline/document/document-service.ts` - Another variant
4. `/scripts/cli-pipeline/document/standalone-document-service.ts` - Standalone version

## Why Multiple Versions Exist
- Each serves different purposes and tables:
  - Shared services version: Manages `documentation_files` table
  - Document pipeline version: Manages general document processing
  
## Recommendation
These should be consolidated or renamed for clarity:
- `DocumentationFileService` - For documentation_files table
- `DocumentPipelineService` - For document processing pipeline

## Migration Details
- Refactored from singleton to BusinessService pattern
- Added dependency injection support
- Enhanced with health checks and metrics
- Improved error handling

## Usage Count
- 4 locations were using the shared services version