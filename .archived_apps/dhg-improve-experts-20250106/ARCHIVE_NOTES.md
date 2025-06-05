# dhg-improve-experts Archive Notes

## Archive Date: 2025-01-06

## Reason for Archiving
Application archived per user request.

## Application Overview
The dhg-improve-experts was a comprehensive expert management and document processing application with the following key features:

### Core Features
1. **Expert Profile Management**
   - Expert creation and editing
   - Expert document association
   - Profile extraction from documents

2. **Document Processing**
   - PDF text extraction and viewing
   - Google Drive integration for document sync
   - Batch processing capabilities
   - Document classification

3. **AI Integration**
   - Claude API integration for content analysis
   - Script analysis capabilities
   - Prompt management system

4. **Database Features**
   - Extensive Supabase integration
   - Function registry management
   - Database inspection tools

5. **UI Components**
   - Comprehensive UI component library (shadcn/ui)
   - Markdown viewer
   - File tree navigation
   - Audio player for transcriptions

### Dependencies
- React 18.3.1
- TypeScript
- Vite
- Tailwind CSS
- Supabase client
- Google APIs
- PDF processing libraries
- Audio processing capabilities

### Services and Utilities
The application contained numerous services that could potentially be shared:
- Google Drive sync service
- Document processing utilities
- AI/Claude API service
- Expert service
- Markdown file service
- Script analysis service
- Authentication utilities

## Post-Archive Actions
1. Removed from pnpm workspace (automatic due to apps/* pattern)
2. Removed dev:experts script from root package.json
3. Application moved to .archived_apps with timestamp

## Potential Service Extraction
Many services from this application could be extracted into shared packages:
- Google Drive integration
- Document processing pipeline
- AI/Claude API wrapper
- PDF utilities
- Audio processing utilities
- Batch processing system

## References
The application is referenced in various documentation files throughout the monorepo. These references remain as historical documentation.