import { functionRegistry } from '../function-registry';

functionRegistry.register('processUnextractedDocuments', {
  description: 'Main batch processor for document content extraction',
  status: 'active',
  location: 'src/utils/document-processing.ts',
  category: 'BATCH_PROCESSING',
  dependencies: ['supabase', 'mammoth'],
  usedIn: ['SourceButtons'],
  targetPackage: 'content-extraction'
}); 