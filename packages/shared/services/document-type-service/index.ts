/**
 * Document Type Service Exports
 * 
 * Main exports for the document type service package.
 */

// Export the document type service and its types
export { 
  DocumentTypeService, 
  documentTypeService,
  DocumentType,
  CreateDocumentTypeParams
} from './document-type-service';

// Export the document type AI service and its types
export {
  DocumentTypeAIService,
  documentTypeAIService,
  DocumentTypeAIResponse,
  GenerateDocumentTypeResult,
  CreateFromAIParams
} from './document-type-ai-service';