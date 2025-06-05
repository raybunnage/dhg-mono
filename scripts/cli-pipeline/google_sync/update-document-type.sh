#!/bin/bash
# Script to update document_type_id field in expert_documents table without foreign key constraint

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables from project root .env.development file if it exists
ENV_DEV_FILE="${ROOT_DIR}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  # Export environment variables for Supabase
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Check if required arguments are provided
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <expert-doc-id> <document-type-id>"
  echo "  expert-doc-id: UUID of the expert document to update"
  echo "  document-type-id: UUID of the document type to set"
  exit 1
fi

EXPERT_DOC_ID=$1
DOCUMENT_TYPE_ID=$2

# First check if the expert document exists
npx ts-node -e "
const { SupabaseClientService } = require('$ROOT_DIR/packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function checkExpertDocument() {
  const { data, error } = await supabase
    .from('expert_documents')
    .select('id, title, document_type_id')
    .eq('id', '$EXPERT_DOC_ID')
    .single();
    
  if (error) {
    console.error('L Error fetching expert document:', error.message);
    process.exit(1);
  }
  
  if (!data) {
    console.error('L Expert document not found');
    process.exit(1);
  }
  
  console.log(' Found expert document:', data.title || 'No title');
  console.log('Current document_type_id:', data.document_type_id || 'None');
}

checkExpertDocument().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"

# Check exit code
if [ $? -ne 0 ]; then
  echo "Error checking expert document"
  exit 1
fi

# Check if document type exists (informational only)
npx ts-node -e "
const { SupabaseClientService } = require('$ROOT_DIR/packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function checkDocumentType() {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name, category')
    .eq('id', '$DOCUMENT_TYPE_ID')
    .single();
    
  if (error) {
    console.error('  Error checking document type:', error.message);
    console.log('This update will still proceed, but note that the document type ID may not exist.');
    return;
  }
  
  if (!data) {
    console.log('  Document type not found');
    console.log('This update will still proceed, but note that the document type ID does not exist.');
    return;
  }
  
  console.log(' Found document type:', data.name);
  console.log('Category:', data.category || 'None');
}

checkDocumentType().catch(err => {
  console.error('Error:', err);
});
"

# Confirm update with user
echo ""
echo "About to update expert document $EXPERT_DOC_ID with document_type_id $DOCUMENT_TYPE_ID"
read -p "Continue? (y/n): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Update cancelled"
  exit 0
fi

# Execute the update directly with SQL
echo "Executing SQL update..."
npx ts-node -e "
const { SupabaseClientService } = require('$ROOT_DIR/packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

async function executeUpdate() {
  try {
    // Direct SQL approach to bypass constraint
    const { error } = await supabase.rpc('execute_sql', {
      sql: \`
        UPDATE expert_documents 
        SET document_type_id = '$DOCUMENT_TYPE_ID',
            updated_at = NOW() 
        WHERE id = '$EXPERT_DOC_ID';
      \`
    });
    
    if (error) {
      console.error('L SQL execution error:', error.message);
      console.log('Trying alternative approach...');
      
      // Try disabling triggers
      const { error: triggerError } = await supabase.rpc('execute_sql', {
        sql: \`
          ALTER TABLE expert_documents DISABLE TRIGGER ALL;
          UPDATE expert_documents 
          SET document_type_id = '$DOCUMENT_TYPE_ID',
              updated_at = NOW() 
          WHERE id = '$EXPERT_DOC_ID';
          ALTER TABLE expert_documents ENABLE TRIGGER ALL;
        \`
      });
      
      if (triggerError) {
        console.error('L Trigger approach error:', triggerError.message);
        return false;
      } else {
        console.log(' Update successful using trigger disabling');
        return true;
      }
    } else {
      console.log(' Update successful using direct SQL');
      return true;
    }
  } catch (err) {
    console.error('L Unexpected error:', err);
    return false;
  }
}

async function verifyUpdate() {
  const { data, error } = await supabase
    .from('expert_documents')
    .select('document_type_id')
    .eq('id', '$EXPERT_DOC_ID')
    .single();
    
  if (error) {
    console.error('L Error verifying update:', error.message);
    return;
  }
  
  if (data.document_type_id === '$DOCUMENT_TYPE_ID') {
    console.log(' Verification successful: document_type_id has been updated');
  } else {
    console.log('L Verification failed: document_type_id is', data.document_type_id);
  }
}

async function run() {
  const success = await executeUpdate();
  if (success) {
    await verifyUpdate();
  }
}

run().catch(err => {
  console.error('Error:', err);
});
"

# Final message
echo "Update process completed."