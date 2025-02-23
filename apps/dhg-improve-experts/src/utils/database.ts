import { SchemaHelper } from '../../../../supabase/utils/schema-helper'

const schemaHelper = new SchemaHelper()

// Example 1: Check column types when building queries
export function buildExpertQuery() {
  // Verify columns exist before using them
  if (schemaHelper.hasColumn('experts', 'expert_name')) {
    return `select expert_name from experts`
  }
  return null
}

// Example 2: Get enum values for validation
export function validateProcessingStatus(status: string) {
  const validStatuses = schemaHelper.getEnumValues('processing_status')
  return validStatuses.includes(status)
}

// Example 3: Check foreign key relationships
export function getRelatedTables(tableName: string) {
  const foreignKeys = schemaHelper.getForeignKeys(tableName)
  return foreignKeys.map(fk => fk.references_table)
}

// Example 4: Working with views
export function getBatchProcessingView() {
  return schemaHelper.getViewDefinition('batch_processing_status')
} 