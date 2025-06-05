#!/usr/bin/env ts-node
/**
 * Test script for creating a document type without a name
 */
import { documentTypeService } from '../../../packages/shared/services/document-type-service';

async function createWithoutName() {
  console.log('Testing document type creation with no name...');
  
  try {
    // For general types, we use the category as the name if no name is provided
    const categoryName = "Test Category";
    console.log(`Using category name "${categoryName}" as the document type name for this general type`);
    
    // Prepare the document type data
    const documentTypeData = {
      name: categoryName,
      category: categoryName,
      description: "Test description",
      is_ai_generated: false,
      is_general_type: true,
      mnemonic: "TST"
    };
    
    console.log('\nDocument Type that would be created:');
    console.log('==============================================================');
    console.log(`Name:            ${documentTypeData.name}`);
    console.log(`Category:        ${documentTypeData.category}`);
    console.log(`Description:     ${documentTypeData.description || 'N/A'}`);
    console.log(`Mnemonic:        ${documentTypeData.mnemonic || 'N/A'}`);
    console.log(`AI Generated:    ${documentTypeData.is_ai_generated ? 'Yes' : 'No'}`);
    console.log(`General Type:    ${documentTypeData.is_general_type ? 'Yes' : 'No'}`);
    
    // This is a dry run - we won't actually create the document type
    console.log('\nThis is a dry run - no document type will be created.');
    
    // Uncomment to actually create the document type
    // const documentType = await documentTypeService.createDocumentType(documentTypeData);
    // console.log('\nDocument Type Created:');
    // console.log('==============================================================');
    // console.log(`ID:              ${documentType.id}`);
    // console.log(`Name:            ${documentType.name}`);
    // console.log(`Category:        ${documentType.category}`);
    // console.log(`Mnemonic:        ${documentType.mnemonic || 'N/A'}`);
    // console.log(`General Type:    ${documentType.is_general_type ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('Error in test script:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
createWithoutName();