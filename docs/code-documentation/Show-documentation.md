# Show Page Documentation

## Overview
The Show page is a comprehensive viewer for presentations and their associated assets. It displays a single presentation with its metadata, supporting materials, themes, and related presentations.

## Features
- **Presentation Display**: Shows the main video or document of a presentation
- **Supporting Materials**: Lists and provides access to associated documents, slides, and other materials
- **Key Themes**: Displays AI-identified themes from the presentation with confidence scores
- **Transcript View**: Shows the transcript of the presentation when available
- **Related Presentations**: Shows and provides access to related content

## Implementation Details

### Component Structure
The main component is located at `apps/dhg-improve-experts/src/pages/Show.tsx` and includes:
- State management for presentation data, selected assets, and loading states
- Mock data generation for demonstration purposes (to be replaced with actual Supabase data fetching)
- File type detection and display formatting
- Asset selection handlers

### Data Models
The component uses several TypeScript interfaces:
- `Presentation`: Main presentation data
- `PresentationAsset`: Supporting materials and documents
- `PresentationTag`: Tags for categorizing presentations
- `PresentationTheme`: AI-identified themes and topics
- `SourceGoogle`: Google Drive source file information
- `ExpertDocument`: Processed document with AI analysis

### Core Functionality
1. **Asset Selection**: Users can select from supporting materials to view them in the main viewer
2. **Related Content Navigation**: Allows navigation between related presentations
3. **Format Support**: Handles various file types including videos, documents, and presentations
4. **Metadata Display**: Shows presentation details like duration, presenter, recording date, etc.

### UI Elements
- Left sidebar with supporting materials and themes
- Main content area with file viewer
- Transcript section below the viewer when available
- Related presentations as thumbnails at the bottom

## Future Development
- Replace mock data with actual Supabase queries
- Implement real navigation between related presentations
- Add proper loading states and error handling for data fetching
- Implement user interaction features like ratings or comments

## Related Components
- `FileViewer`: Used to display different file types
- `FileTree`: Provides file type detection and styling information