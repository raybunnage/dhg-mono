# Document Type UI Component Archive Notes

## Archived Components
- `src/components/document-types/DocumentTypeForm.tsx`
- `src/pages/document-types/index.tsx`

## Date of Archive
- Archived on: March 3, 2025

## Component Overview

### DocumentTypeForm.tsx
A React component that provides a form for creating and editing document types. The component handles:
- Creating new document types with fields for name, category, description, MIME type, file extension
- Editing existing document types
- Form validation
- Supabase database integration for saving/updating document types
- Category and MIME type selection from existing options

### document-types/index.tsx
A page component that provides a UI for managing document types, including:
- Listing all document types in a table view
- Filtering document types by category
- Adding new document types via a dialog
- Editing existing document types
- Deleting document types
- Displaying usage statistics

## Integration Points
- The document types page is registered in `App.tsx` as a route at `/document-types`
- No other components in the codebase currently import or use these components

## Reinstatement Instructions

To restore this functionality:

1. Copy the archived files back to their original locations:
   ```
   src/components/document-types/DocumentTypeForm.tsx
   src/pages/document-types/index.tsx
   ```

2. Ensure the route is still defined in `App.tsx`:
   ```jsx
   <Route path="/document-types" element={<DocumentTypesPage />} />
   ```

3. Make sure the necessary dependencies are available:
   - react-hook-form (for form handling)
   - shadcn/ui components
   - Supabase client for database operations

4. Test the document types page by navigating to `/document-types` in the app

## Database Schema

The components interact with the `document_types` table in Supabase with the following schema:

```typescript
interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string;
  mime_type: string | null;
  file_extension: string | null;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}
```

## Notes
- These components were part of a document classification and management system
- The functionality may need to be updated if database schemas have changed
- The UI uses shadcn components and Tailwind CSS for styling