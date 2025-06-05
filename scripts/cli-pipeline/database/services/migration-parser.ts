/**
 * Migration Parser Service
 * 
 * Parses SQL migration files with section-based structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  ParsedMigration, 
  MigrationMetadata, 
  MigrationSection, 
  MigrationSectionType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SectionValidation
} from '../types/migration';

export class MigrationParser {
  private static readonly SECTION_TYPES: MigrationSectionType[] = [
    'extensions',
    'tables',
    'indexes', 
    'functions',
    'triggers',
    'rls',
    'grants',
    'views',
    'custom'
  ];

  private static readonly SECTION_ORDER: Record<MigrationSectionType, number> = {
    extensions: 1,
    tables: 2,
    indexes: 3,
    functions: 4,
    triggers: 5,
    views: 6,
    rls: 7,
    grants: 8,
    custom: 9
  };

  /**
   * Parse a migration file
   */
  public static async parseMigrationFile(filePath: string): Promise<ParsedMigration> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const metadata = this.parseMetadata(content, filePath);
    const sections = this.parseSections(content);

    return {
      metadata,
      sections,
      filePath,
      rawContent: content
    };
  }

  /**
   * Parse migration metadata from comments
   */
  private static parseMetadata(content: string, filePath?: string): MigrationMetadata {
    const lines = content.split('\n');
    const metadata: Partial<MigrationMetadata> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('-- MIGRATION:')) {
        metadata.name = trimmed.replace('-- MIGRATION:', '').trim();
      } else if (trimmed.startsWith('-- VERSION:')) {
        metadata.version = trimmed.replace('-- VERSION:', '').trim();
      } else if (trimmed.startsWith('-- DESCRIPTION:')) {
        metadata.description = trimmed.replace('-- DESCRIPTION:', '').trim();
      } else if (trimmed.startsWith('-- AUTHOR:')) {
        metadata.author = trimmed.replace('-- AUTHOR:', '').trim();
      } else if (trimmed.startsWith('-- DEPENDENCIES:')) {
        const deps = trimmed.replace('-- DEPENDENCIES:', '').trim();
        metadata.dependencies = deps.split(',').map(d => d.trim()).filter(d => d);
      }
    }

    // Provide defaults for missing metadata (for legacy files)
    if (!metadata.name) {
      // Extract name from file path if available
      if (filePath) {
        const fileName = path.basename(filePath, '.sql');
        metadata.name = fileName.replace(/^\d+_/, ''); // Remove timestamp prefix
      } else {
        metadata.name = 'legacy_migration';
      }
    }
    if (!metadata.version) {
      // Use current timestamp as default
      metadata.version = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    }
    if (!metadata.description) {
      metadata.description = 'Legacy migration file without metadata';
    }

    return metadata as MigrationMetadata;
  }

  /**
   * Parse sections from migration content
   */
  private static parseSections(content: string): MigrationSection[] {
    const lines = content.split('\n');
    const sections: MigrationSection[] = [];
    let currentSection: Partial<MigrationSection> | null = null;
    let currentSql: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for section header
      if (trimmed.startsWith('-- SECTION:')) {
        // Save previous section if it exists
        if (currentSection && currentSection.name) {
          sections.push({
            ...currentSection,
            sql: currentSql.join('\n').trim(),
            order: this.SECTION_ORDER[currentSection.type!] || 999
          } as MigrationSection);
        }

        // Start new section
        const sectionName = trimmed.replace('-- SECTION:', '').trim();
        const sectionType = this.determineSectionType(sectionName);
        
        currentSection = {
          name: sectionName,
          type: sectionType,
          dependencies: []
        };
        currentSql = [];
      } else if (currentSection && !trimmed.startsWith('--')) {
        // Add SQL content to current section (skip comment lines)
        if (trimmed) {
          currentSql.push(line);
        }
      } else if (!currentSection && !trimmed.startsWith('--') && trimmed) {
        // SQL outside of sections - create default section
        if (!currentSection) {
          currentSection = {
            name: 'default',
            type: 'custom',
            dependencies: []
          };
          currentSql = [];
        }
        currentSql.push(line);
      }
    }

    // Save final section
    if (currentSection && currentSection.name) {
      sections.push({
        ...currentSection,
        sql: currentSql.join('\n').trim(),
        order: this.SECTION_ORDER[currentSection.type!] || 999
      } as MigrationSection);
    }

    // Sort sections by order
    sections.sort((a, b) => a.order - b.order);

    return sections;
  }

  /**
   * Determine section type from section name
   */
  private static determineSectionType(sectionName: string): MigrationSectionType {
    const normalized = sectionName.toLowerCase();
    
    if (normalized.includes('extension')) return 'extensions';
    if (normalized.includes('table')) return 'tables';
    if (normalized.includes('index')) return 'indexes';
    if (normalized.includes('function')) return 'functions';
    if (normalized.includes('trigger')) return 'triggers';
    if (normalized.includes('rls') || normalized.includes('policy')) return 'rls';
    if (normalized.includes('grant') || normalized.includes('permission')) return 'grants';
    if (normalized.includes('view')) return 'views';
    
    return 'custom';
  }

  /**
   * Validate parsed migration
   */
  public static validateMigration(migration: ParsedMigration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const sectionValidations: SectionValidation[] = [];

    // Validate metadata
    this.validateMetadata(migration.metadata, errors, warnings);

    // Validate each section
    for (const section of migration.sections) {
      const sectionValidation = this.validateSection(section);
      sectionValidations.push(sectionValidation);
      
      errors.push(...sectionValidation.errors);
      warnings.push(...sectionValidation.warnings);
    }

    // Check for section dependencies
    this.validateSectionDependencies(migration.sections, errors);

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      sections: sectionValidations
    };
  }

  /**
   * Validate migration metadata
   */
  private static validateMetadata(
    metadata: MigrationMetadata, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check version format
    if (!/^\d{14}$/.test(metadata.version)) {
      warnings.push({
        message: 'Version should be in timestamp format (YYYYMMDDHHMMSS)',
        type: 'best-practice'
      });
    }

    // Check for reasonable description length
    if (metadata.description.length < 10) {
      warnings.push({
        message: 'Description should be more descriptive',
        type: 'best-practice'
      });
    }
  }

  /**
   * Validate individual section
   */
  private static validateSection(section: MigrationSection): SectionValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic SQL validation
    this.validateSql(section.sql, section.name, errors, warnings);

    // Section-specific validation
    switch (section.type) {
      case 'tables':
        this.validateTableSection(section.sql, errors, warnings);
        break;
      case 'indexes':
        this.validateIndexSection(section.sql, errors, warnings);
        break;
      case 'functions':
        this.validateFunctionSection(section.sql, errors, warnings);
        break;
      case 'rls':
        this.validateRLSSection(section.sql, errors, warnings);
        break;
    }

    return {
      sectionName: section.name,
      sectionType: section.type,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Basic SQL validation
   */
  private static validateSql(
    sql: string, 
    sectionName: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check for common SQL issues
    if (sql.includes('DROP TABLE') && !sql.includes('IF EXISTS')) {
      warnings.push({
        section: sectionName,
        message: 'DROP TABLE without IF EXISTS may cause errors if table does not exist',
        type: 'best-practice'
      });
    }

    // Check for missing semicolons
    const statements = sql.split(';').filter(s => s.trim());
    if (statements.length > 1 && !sql.trim().endsWith(';')) {
      errors.push({
        section: sectionName,
        message: 'SQL statements should end with semicolons',
        type: 'syntax',
        severity: 'error'
      });
    }

    // Check for SQL injection patterns (basic)
    const dangerousPatterns = [
      /\$\{.*\}/g,  // Template literals
      /\$\w+/g      // Variable substitution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        errors.push({
          section: sectionName,
          message: 'Potential SQL injection vulnerability detected',
          type: 'security',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate table creation section
   */
  private static validateTableSection(
    sql: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check for IF NOT EXISTS
    if (sql.includes('CREATE TABLE') && !sql.includes('IF NOT EXISTS')) {
      warnings.push({
        message: 'Consider using CREATE TABLE IF NOT EXISTS for safer migrations',
        type: 'best-practice'
      });
    }

    // Check for primary keys
    if (sql.includes('CREATE TABLE') && !sql.includes('PRIMARY KEY')) {
      warnings.push({
        message: 'Tables should have primary keys',
        type: 'best-practice'
      });
    }

    // Check for timestamps
    if (sql.includes('CREATE TABLE') && !sql.includes('created_at')) {
      warnings.push({
        message: 'Consider adding created_at timestamp',
        type: 'best-practice'
      });
    }
  }

  /**
   * Validate index creation section
   */
  private static validateIndexSection(
    sql: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    if (sql.includes('CREATE INDEX') && !sql.includes('IF NOT EXISTS')) {
      warnings.push({
        message: 'Consider using CREATE INDEX IF NOT EXISTS',
        type: 'best-practice'
      });
    }
  }

  /**
   * Validate function creation section
   */
  private static validateFunctionSection(
    sql: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    if (sql.includes('CREATE FUNCTION') && !sql.includes('OR REPLACE')) {
      warnings.push({
        message: 'Consider using CREATE OR REPLACE FUNCTION',
        type: 'best-practice'
      });
    }

    // Check for SECURITY DEFINER functions
    if (sql.includes('SECURITY DEFINER')) {
      warnings.push({
        message: 'SECURITY DEFINER functions require careful security review',
        type: 'best-practice'
      });
    }
  }

  /**
   * Validate RLS section
   */
  private static validateRLSSection(
    sql: string, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Check that RLS is enabled before creating policies
    if (sql.includes('CREATE POLICY') && !sql.includes('ENABLE ROW LEVEL SECURITY')) {
      warnings.push({
        message: 'Ensure RLS is enabled on tables before creating policies',
        type: 'best-practice'
      });
    }
  }

  /**
   * Validate section dependencies
   */
  private static validateSectionDependencies(
    sections: MigrationSection[], 
    errors: ValidationError[]
  ): void {
    const sectionNames = sections.map(s => s.name);

    for (const section of sections) {
      if (section.dependencies) {
        for (const dep of section.dependencies) {
          if (!sectionNames.includes(dep)) {
            errors.push({
              section: section.name,
              message: `Missing dependency: ${dep}`,
              type: 'dependency',
              severity: 'error'
            });
          }
        }
      }
    }
  }

  /**
   * Extract SQL objects from sections
   */
  public static extractSqlObjects(migration: ParsedMigration): {
    tables: string[];
    functions: string[];
    indexes: string[];
    policies: string[];
  } {
    const tables: string[] = [];
    const functions: string[] = [];
    const indexes: string[] = [];
    const policies: string[] = [];

    for (const section of migration.sections) {
      const sql = section.sql.toUpperCase();

      // Extract table names
      const tableMatches = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi);
      if (tableMatches) {
        tables.push(...tableMatches.map(m => m.split(/\s+/).pop()!.toLowerCase()));
      }

      // Extract function names
      const functionMatches = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/gi);
      if (functionMatches) {
        functions.push(...functionMatches.map(m => m.split(/\s+/).pop()!.toLowerCase()));
      }

      // Extract index names
      const indexMatches = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)/gi);
      if (indexMatches) {
        indexes.push(...indexMatches.map(m => m.split(/\s+/).pop()!.toLowerCase()));
      }

      // Extract policy names
      const policyMatches = sql.match(/CREATE\s+POLICY\s+([^\s]+)/gi);
      if (policyMatches) {
        policies.push(...policyMatches.map(m => m.split(/\s+/).pop()!.toLowerCase()));
      }
    }

    return { tables, functions, indexes, policies };
  }
}