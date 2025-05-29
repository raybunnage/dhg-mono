# DHG Admin Explore

A Google Drive file explorer for the DHG platform, built with React and using shared services.

## Features

- **File Tree Visualization**: Browse Google Drive files stored in `sources_google` table
- **Recursive Folder Navigation**: Uses drive_id and parent_folder_id for proper hierarchy
- **File Details View**: View file metadata, content, and processing status
- **Path Repair Tools**: Admin tools to fix file path inconsistencies
- **Relationship Analysis**: Debug tools for analyzing file relationships

## Architecture

This app demonstrates the DHG platform's architecture principles:

1. **Shared Services**: Uses the `GoogleDriveExplorerService` from `packages/shared/services`
2. **Shared Components**: Uses `FileTree` and `FileViewer` from `packages/shared/components`
3. **Browser Adapter Pattern**: Uses the `supabase-adapter` for browser-compatible Supabase access
4. **Cross-Environment Design**: Services work in both browser and CLI environments

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env.development`:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   # or
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5176 (or the port shown in terminal)

## Key Components

- **GoogleDriveExplorerService**: Handles all database operations for file exploration
- **FileTree**: Renders hierarchical file structure with expand/collapse functionality
- **FileViewer**: Displays file details, metadata, and content
- **Viewer Page**: Main page that orchestrates the file explorer functionality

## Database Schema

The app works with the `sources_google` table which has:
- `id`: Supabase UUID
- `drive_id`: Google Drive file ID (used for hierarchy navigation)
- `parent_folder_id`: Parent's drive_id (not Supabase UUID)
- `path`: Full file path
- `parent_path`: Parent folder path
- `is_root`: Boolean flag for root folders
- `path_depth`: Depth in folder hierarchy

## Deployment

The app is configured for Netlify deployment:
```bash
npm run build
```

Deploy the `dist` folder to Netlify.