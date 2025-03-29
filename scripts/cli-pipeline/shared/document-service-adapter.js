/**
 * Document Service Adapter
 * 
 * This adapter provides JavaScript functions to interact with document services
 * without needing to directly use TypeScript.
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Get recent documents
 */
async function getRecentDocuments(supabaseUrl, supabaseKey, limit = 20) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch documents without using foreign key relationship
    const { data, error } = await supabase
      .from('documentation_files')
      .select(`
        id, 
        file_path, 
        title, 
        language, 
        document_type_id,
        created_at, 
        updated_at
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching recent documents:', error);
      return [];
    }
    
    // Enhance with document type information
    const enhancedDocs = await enhanceDocumentsWithTypes(data, supabase);
    
    return enhancedDocs;
  } catch (error) {
    console.error('Error in getRecentDocuments:', error);
    return [];
  }
}

/**
 * Get untyped documents
 */
async function getUntypedDocuments(supabaseUrl, supabaseKey, limit = 20) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('documentation_files')
      .select(`
        id, 
        file_path, 
        title, 
        language, 
        document_type_id,
        created_at, 
        updated_at
      `)
      .is('document_type_id', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching untyped documents:', error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUntypedDocuments:', error);
    return [];
  }
}

/**
 * Get document types
 */
async function getDocumentTypes(supabaseUrl, supabaseKey) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('document_types')
      .select('id, document_type, description')
      .order('document_type');
    
    if (error) {
      console.error('Error fetching document types:', error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error in getDocumentTypes:', error);
    return [];
  }
}

/**
 * Find document type by name
 */
async function findDocumentTypeByName(supabaseUrl, supabaseKey, typeName) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('document_types')
      .select('id, document_type, description')
      .ilike('document_type', typeName)
      .limit(1);
    
    if (error) {
      console.error(`Error fetching document type by name ${typeName}:`, error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    return data[0];
  } catch (error) {
    console.error(`Error in findDocumentTypeByName for ${typeName}:`, error);
    return null;
  }
}

/**
 * Update document classification
 */
async function updateDocumentClassification(supabaseUrl, supabaseKey, documentId, classification) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, find the document type
    const docType = await findDocumentTypeByName(supabaseUrl, supabaseKey, classification.document_type);
    
    if (!docType) {
      console.error(`Document type not found: ${classification.document_type}`);
      return false;
    }
    
    // Get current metadata
    const { data: currentDoc, error: fetchError } = await supabase
      .from('documentation_files')
      .select('metadata')
      .eq('id', documentId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching current metadata:`, fetchError);
      return false;
    }
    
    // Prepare updated metadata
    const currentMetadata = currentDoc.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ai_classification_confidence: classification.confidence,
      ai_classification_reasoning: classification.reasoning
    };
    
    // Update the document
    const { error } = await supabase
      .from('documentation_files')
      .update({
        document_type_id: docType.id,
        metadata: updatedMetadata,
        updated_at: new Date()
      })
      .eq('id', documentId);
    
    if (error) {
      console.error(`Error updating document classification:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error in updateDocumentClassification:`, error);
    return false;
  }
}

/**
 * Helper function to enhance documents with their types
 */
async function enhanceDocumentsWithTypes(documents, supabase) {
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // Get all unique document type IDs
  const typeIds = [...new Set(
    documents
      .filter(doc => doc.document_type_id)
      .map(doc => doc.document_type_id)
  )];
  
  // If there are no type IDs, return the original documents
  if (typeIds.length === 0) {
    return documents.map(doc => ({
      ...doc,
      document_type: { name: 'Untyped' }
    }));
  }
  
  // Fetch document types
  const { data: typeData, error } = await supabase
    .from('document_types')
    .select('id, document_type')
    .in('id', typeIds);
  
  if (error) {
    console.error('Error fetching document types:', error);
    return documents;
  }
  
  // Create a map of typeId to type name
  const typeMap = {};
  typeData.forEach(type => {
    typeMap[type.id] = type.document_type;
  });
  
  // Enhance documents with type information
  return documents.map(doc => {
    const typeName = doc.document_type_id && typeMap[doc.document_type_id] 
      ? typeMap[doc.document_type_id] 
      : 'Untyped';
    
    return {
      ...doc,
      document_type: { name: typeName }
    };
  });
}

module.exports = {
  getRecentDocuments,
  getUntypedDocuments,
  getDocumentTypes,
  findDocumentTypeByName,
  updateDocumentClassification
};