import { Database } from '../types'
import schemaInfo from '../schema-info.json'

type SchemaInfo = typeof schemaInfo

export class SchemaHelper {
  private schema: SchemaInfo

  constructor() {
    this.schema = schemaInfo
  }

  /**
   * Get all columns for a table including constraints and types
   */
  getTableColumns(tableName: keyof Database['public']['Tables']) {
    return this.schema.tables[tableName]?.columns || []
  }

  /**
   * Get foreign key relationships for a table
   */
  getForeignKeys(tableName: keyof Database['public']['Tables']) {
    return this.schema.tables[tableName]?.foreign_keys || []
  }

  /**
   * Get all enums defined in the database
   */
  getEnums() {
    return this.schema.enums || {}
  }

  /**
   * Get specific enum values
   */
  getEnumValues(enumName: string) {
    return this.schema.enums?.[enumName] || []
  }

  /**
   * Get view definition
   */
  getViewDefinition(viewName: keyof Database['public']['Views']) {
    return this.schema.views?.[viewName]?.definition
  }

  /**
   * Check if a column exists in a table
   */
  hasColumn(tableName: keyof Database['public']['Tables'], columnName: string) {
    const columns = this.getTableColumns(tableName)
    return columns.some(col => col.name === columnName)
  }

  /**
   * Get column type information
   */
  getColumnType(tableName: keyof Database['public']['Tables'], columnName: string) {
    const columns = this.getTableColumns(tableName)
    return columns.find(col => col.name === columnName)?.type
  }

  /**
   * Get all indexes for a table
   */
  getTableIndexes(tableName: keyof Database['public']['Tables']) {
    return this.schema.tables[tableName]?.indexes || []
  }

  /**
   * Check if a table has specific constraints
   */
  hasConstraint(tableName: keyof Database['public']['Tables'], constraintType: 'primary_key' | 'foreign_key' | 'check' | 'unique') {
    const table = this.schema.tables[tableName]
    switch (constraintType) {
      case 'primary_key':
        return !!table?.primary_key
      case 'foreign_key':
        return (table?.foreign_keys || []).length > 0
      case 'check':
        return (table?.check_constraints || []).length > 0
      case 'unique':
        return (table?.indexes || []).some(idx => idx.definition.includes('UNIQUE'))
      default:
        return false
    }
  }
} 