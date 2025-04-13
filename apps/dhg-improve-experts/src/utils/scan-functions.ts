import { functionRegistry } from './function-registry';

// Function categories for organization
const FUNCTION_CATEGORIES = {
  CONTENT_EXTRACTION: {
    pattern: /(extract|process|convert|parse)/i,
    description: 'Content extraction and processing'
  },
  GOOGLE_DRIVE: {
    pattern: /(drive|file|folder|sync)/i,
    description: 'Google Drive operations'
  },
  UI_INTERACTION: {
    pattern: /(handle|toggle|show|hide)/i,
    description: 'UI event handlers'
  },
  DATA_MANAGEMENT: {
    pattern: /(load|save|update|delete|fetch)/i,
    description: 'Data operations'
  }
};

// Initial registry entries based on your codebase
const initialRegistry = {
  // Content Extraction Functions
  'handleExtractContent': {
    name: 'handleExtractContent',
    description: 'Extracts content from Google Drive documents',
    status: 'active',
    location: 'src/components/SourceButtons.tsx',
    dependencies: ['mammoth', 'supabase'],
    category: 'CONTENT_EXTRACTION',
    usedIn: ['SourceButtons', 'source-buttons.tsx'],
    targetPackage: 'content-extraction'
  },

  'processUnextractedDocuments': {
    name: 'processUnextractedDocuments',
    description: 'Batch processes documents that need content extraction',
    status: 'active',
    location: 'src/utils/document-processing.ts',
    dependencies: ['supabase', 'mammoth'],
    category: 'CONTENT_EXTRACTION',
    usedIn: ['SourceButtons'],
    targetPackage: 'content-extraction'
  },

  'testSingleDocument': {
    name: 'testSingleDocument',
    description: 'Tests content extraction on a single document',
    status: 'experimental',
    location: 'src/utils/document-processing.ts',
    dependencies: ['supabase'],
    category: 'CONTENT_EXTRACTION',
    usedIn: ['SourceButtons']
  },

  // Google Drive Functions
  'syncGoogleDriveFiles': {
    name: 'syncGoogleDriveFiles',
    description: 'Syncs files from Google Drive to local database',
    status: 'active',
    location: 'src/utils/google-drive-sync.ts',
    dependencies: ['supabase', 'google-apis'],
    category: 'GOOGLE_DRIVE',
    usedIn: ['SourceButtons'],
    targetPackage: 'google-drive-sync'
  },

  'listAllDriveFiles': {
    name: 'listAllDriveFiles',
    description: 'Recursively lists all files in Google Drive folder',
    status: 'active',
    location: 'src/utils/google-drive.ts',
    dependencies: ['google-apis'],
    category: 'GOOGLE_DRIVE',
    usedIn: ['SourceButtons'],
    targetPackage: 'google-drive-sync'
  },

  'syncFileMetadata': {
    name: 'syncFileMetadata',
    description: 'Updates metadata for Google Drive files',
    status: 'active',
    location: 'src/utils/metadata-sync.ts',
    dependencies: ['supabase', 'google-apis'],
    category: 'GOOGLE_DRIVE',
    usedIn: ['SourceButtons'],
    targetPackage: 'google-drive-sync'
  },

  // UI Functions
  'handleTestEnvironment': {
    name: 'handleTestEnvironment',
    description: 'Tests environment configuration and connections',
    status: 'active',
    location: 'src/components/SourceButtons.tsx',
    dependencies: ['google-apis'],
    category: 'UI_INTERACTION',
    usedIn: ['SourceButtons']
  },

  'handleTestExtraction': {
    name: 'handleTestExtraction',
    description: 'Tests content extraction process',
    status: 'experimental',
    location: 'src/components/SourceButtons.tsx',
    dependencies: ['supabase', 'mammoth'],
    category: 'UI_INTERACTION',
    usedIn: ['SourceButtons']
  },

  // PDF Processing
  'getPdfContent': {
    name: 'getPdfContent',
    description: 'Extracts content from PDF files',
    status: 'active',
    location: 'src/utils/google-drive.ts',
    dependencies: ['pdfjs-dist'],
    category: 'CONTENT_EXTRACTION',
    usedIn: ['FileViewer'],
    targetPackage: 'content-extraction'
  },

  // Document Processing
  'processDocumentWithAI': {
    name: 'processDocumentWithAI',
    description: 'Processes documents using AI for content extraction',
    status: 'experimental',
    location: 'src/utils/ai-processing.ts',
    dependencies: ['anthropic', 'supabase'],
    category: 'CONTENT_EXTRACTION',
    usedIn: ['SourceButtons'],
    targetPackage: 'ai-processing'
  }
};

// Update the registry with initial entries
Object.entries(initialRegistry).forEach(([key, value]) => {
  functionRegistry[key] = value;
});

// Export function to scan for new functions
export function scanForNewFunctions() {
  // This would scan your codebase for functions not in registry
  // For now, we're using the manual registry above
  console.log('Function registry initialized with', Object.keys(functionRegistry).length, 'functions');
} 