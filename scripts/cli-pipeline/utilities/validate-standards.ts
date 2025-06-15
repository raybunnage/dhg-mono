#!/usr/bin/env ts-node

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface Standards {
  database: {
    tables: any;
    columns: any;
    prohibited: string[];
  };
  services: {
    implementation_patterns: any;
    required_features: string[];
  };
  testing: {
    coverage: any;
  };
}

/**
 * Validates project against standards defined in .continuous/standards.yaml
 */
class StandardsValidator {
  private standards: Standards;
  private supabase = SupabaseClientService.getInstance().getClient();

  constructor() {
    const standardsPath = path.join(process.cwd(), '.continuous', 'standards.yaml');
    if (!fs.existsSync(standardsPath)) {
      throw new Error('Standards file not found at .continuous/standards.yaml');
    }
    
    const standardsContent = fs.readFileSync(standardsPath, 'utf8');
    this.standards = yaml.load(standardsContent) as Standards;
  }

  /**
   * Validate database tables against naming standards
   */
  async validateDatabaseTables() {
    console.log('\n🔍 Validating Database Tables...');
    
    // Get all tables
    const { data: tables, error } = await this.supabase.rpc('get_tables_info');
    
    if (error) {
      console.error('❌ Error fetching tables:', error);
      return;
    }

    let violations = 0;
    const prefixes = this.standards.database.tables.naming[2].reserved_prefixes;

    for (const table of tables || []) {
      const tableName = table.table_name;
      
      // Check snake_case_plural
      if (!this.isSnakeCasePlural(tableName)) {
        console.log(`  ❌ ${tableName} - Not snake_case_plural`);
        violations++;
      }

      // Check prefix
      const hasValidPrefix = prefixes.some((prefix: string) => 
        tableName.startsWith(prefix)
      );
      
      if (!hasValidPrefix && !['users', 'profiles'].includes(tableName)) {
        console.log(`  ⚠️  ${tableName} - Missing standard prefix`);
        violations++;
      }
    }

    console.log(`\n  Total violations: ${violations}`);
  }

  /**
   * Validate service implementations
   */
  async validateServices() {
    console.log('\n🔍 Validating Services...');
    
    const servicesDir = path.join(process.cwd(), 'packages', 'shared', 'services');
    const violations: string[] = [];

    // Check for singleton pattern in infrastructure services
    const infrastructureServices = [
      'supabase-client',
      'claude-service',
      'logger'
    ];

    for (const service of infrastructureServices) {
      const servicePath = path.join(servicesDir, service);
      if (fs.existsSync(servicePath)) {
        const files = fs.readdirSync(servicePath)
          .filter(f => f.endsWith('.ts') && !f.includes('.test.'));
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(servicePath, file), 'utf8');
          
          // Check for singleton pattern
          if (!content.includes('private static instance')) {
            violations.push(`${service}/${file} - Missing singleton pattern`);
          }
          
          // Check for environment detection
          if (!content.includes('typeof window')) {
            violations.push(`${service}/${file} - Missing environment detection`);
          }
        }
      }
    }

    violations.forEach(v => console.log(`  ❌ ${v}`));
    console.log(`\n  Total violations: ${violations.length}`);
  }

  /**
   * Generate summary report
   */
  generateReport() {
    console.log('\n📊 Standards Validation Summary');
    console.log('================================');
    console.log('✅ Standards file loaded successfully');
    console.log(`📍 Location: .continuous/standards.yaml`);
    console.log('\nNext Steps:');
    console.log('1. Fix any violations found above');
    console.log('2. Add pre-commit hooks to enforce standards');
    console.log('3. Update CI/CD to run validation');
  }

  private isSnakeCasePlural(name: string): boolean {
    // Check snake_case
    if (name !== name.toLowerCase() || name.includes('-')) {
      return false;
    }
    
    // Simple plural check (ends with 's' but not 'ss')
    return name.endsWith('s') && !name.endsWith('ss');
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Standards Validation Tool');
    console.log('============================');
    
    const validator = new StandardsValidator();
    
    // Run validations
    await validator.validateDatabaseTables();
    await validator.validateServices();
    
    // Generate report
    validator.generateReport();
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}