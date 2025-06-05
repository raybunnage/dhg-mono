#!/bin/bash
# Script to create a general document type category

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Function to load environment variables
load_environment() {
  # Load environment variables from .env files in project root
  for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/.env.development"; do
    if [ -f "$env_file" ]; then
      echo "Loading environment variables from $env_file"
      set -o allexport
      source "$env_file"
      set +o allexport
    fi
  done
}

# Load environment variables
load_environment

# Check if category is provided
if [ -z "$1" ]; then
  echo "Error: Category is required"
  echo "Usage: $0 <category> [--description \"description\"] [--mnemonic \"code\"] [--ai-generated] [--dry-run]"
  exit 1
fi

# Set category 
CATEGORY="$1"
shift

# Parse remaining arguments
DESCRIPTION=""
MNEMONIC=""
AI_GENERATED="false"
DRY_RUN="false"

# Process remaining arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --description)
      DESCRIPTION="$2"
      shift 2
      ;;
    --mnemonic)
      MNEMONIC="$2"
      shift 2
      ;;
    --ai-generated)
      AI_GENERATED="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Escape description for proper inclusion in JavaScript code
if [ -n "$DESCRIPTION" ]; then
  # Replace newlines with \n
  DESCRIPTION=$(echo "$DESCRIPTION" | tr '\n' ' ')
  # Escape quotes for JavaScript
  DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/"/\\"/g')
  DESCRIPTION_JS="\"$DESCRIPTION\""
else
  DESCRIPTION_JS="null"
fi

# Escape mnemonic for proper inclusion in JavaScript code
if [ -n "$MNEMONIC" ]; then
  # Escape quotes for JavaScript
  MNEMONIC=$(echo "$MNEMONIC" | sed 's/"/\\"/g')
  MNEMONIC_JS="\"$MNEMONIC\""
else
  MNEMONIC_JS="null"
fi

# Create a temporary TypeScript file for this specific operation
TMP_SCRIPT="$SCRIPT_DIR/tmp_create_category.ts"

cat > "$TMP_SCRIPT" << EOT
#!/usr/bin/env ts-node
/**
 * Script to create a document type category
 */
import { documentTypeService } from '../../../packages/shared/services/document-type-service';

async function createCategory() {
  console.log('Creating category document type...');
  
  try {
    // Prepare the document type data
    const documentTypeData = {
      name: "${CATEGORY}",
      category: "${CATEGORY}",
      description: ${DESCRIPTION_JS},
      is_ai_generated: ${AI_GENERATED},
      is_general_type: true,
      mnemonic: ${MNEMONIC_JS}
    };
    
    console.log('\\nDocument Type Category that would be created:');
    console.log('==============================================================');
    console.log(\`Category:        \${documentTypeData.category}\`);
    console.log(\`Description:     \${documentTypeData.description || 'N/A'}\`);
    console.log(\`Mnemonic:        \${documentTypeData.mnemonic || 'N/A'}\`);
    console.log(\`AI Generated:    \${documentTypeData.is_ai_generated ? 'Yes' : 'No'}\`);
    console.log(\`General Type:    Yes\`);
    
    if (${DRY_RUN}) {
      console.log('\\nThis is a dry run - no document type will be created.');
      return;
    }
    
    // Actually create the document type
    const documentType = await documentTypeService.createDocumentType(documentTypeData);
    
    console.log('\\nDocument Type Category Created:');
    console.log('==============================================================');
    console.log(\`ID:              \${documentType.id}\`);
    console.log(\`Category:        \${documentType.category}\`);
    console.log(\`Mnemonic:        \${documentType.mnemonic || 'N/A'}\`);
    
  } catch (error) {
    console.error('Error creating category:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the category creation
createCategory();
EOT

chmod +x "$TMP_SCRIPT"

# Execute the script
cd "$PROJECT_ROOT" && ts-node "$TMP_SCRIPT"

# Clean up the temporary script
rm "$TMP_SCRIPT"