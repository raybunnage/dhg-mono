#!/usr/bin/env ts-node

import { getSupabaseClient } from './utils/supabase-helper';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  serviceName: string;
  registryName: string;
  actualReferences: string[];
  isActuallyUsed: boolean;
  recommendation: 'keep' | 'review' | 'archive';
  notes: string;
}

async function validateUnusedServices() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Validating unused services with string search...\n');
  
  // Get all unused services
  const { data: unusedServices, error } = await supabase
    .from('registry_unused_services_view')
    .select('*')
    .eq('is_unused', true)
    .order('service_name');
    
  if (error) {
    console.error('Error fetching unused services:', error);
    return;
  }
  
  const results: ValidationResult[] = [];
  const monorepoRoot = path.resolve(__dirname, '../../..');
  
  for (const service of unusedServices) {
    console.log(`Validating: ${service.service_name}`);
    
    const searchPatterns = [
      service.service_name,
      service.service_name + '-service',
      service.service_name.replace('-service', ''),
      service.service_name.replace('-', ''),
      // Handle CamelCase variants
      service.service_name.replace(/-(.)/g, (_, letter) => letter.toUpperCase())
    ].filter((pattern, index, arr) => arr.indexOf(pattern) === index); // Remove duplicates
    
    const references: string[] = [];
    
    for (const pattern of searchPatterns) {
      try {
        // Search for imports and references
        const grepCommand = `find ${monorepoRoot} -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | xargs grep -l "${pattern}" 2>/dev/null | grep -v node_modules | grep -v .archived`;
        const { execSync } = require('child_process');
        const output = execSync(grepCommand, { encoding: 'utf8', stdio: 'pipe' }).trim();
        
        if (output) {
          const files = output.split('\n').filter(f => f.trim());
          references.push(...files);
        }
      } catch (error) {
        // No matches found, continue
      }
    }
    
    // Remove duplicates and filter out the service file itself
    const uniqueReferences = [...new Set(references)]
      .filter(ref => !ref.includes(service.package_path) || !ref.endsWith(`${service.service_name}.ts`));
    
    const isActuallyUsed = uniqueReferences.length > 0;
    
    let recommendation: 'keep' | 'review' | 'archive' = 'archive';
    let notes = '';
    
    if (isActuallyUsed) {
      recommendation = 'keep';
      notes = `Found ${uniqueReferences.length} references`;
    } else if (service.service_name.includes('browser') || service.service_name.includes('cli')) {
      recommendation = 'review';
      notes = 'Environment-specific service, may be imported differently';
    } else if (service.service_name.includes('test') || service.service_name.includes('config')) {
      recommendation = 'archive';
      notes = 'Test/config file, safe to archive';
    }
    
    results.push({
      serviceName: service.service_name,
      registryName: service.service_name,
      actualReferences: uniqueReferences,
      isActuallyUsed,
      recommendation,
      notes
    });
  }
  
  // Group results by recommendation
  const keep = results.filter(r => r.recommendation === 'keep');
  const review = results.filter(r => r.recommendation === 'review');
  const archive = results.filter(r => r.recommendation === 'archive');
  
  console.log('\n📊 Validation Results Summary:');
  console.log(`✅ Keep (actually used): ${keep.length}`);
  console.log(`🔍 Review (need manual check): ${review.length}`);
  console.log(`🗑️  Archive (safe to remove): ${archive.length}`);
  
  if (keep.length > 0) {
    console.log('\n✅ Services to KEEP (actually used):');
    console.log('=====================================');
    for (const service of keep) {
      console.log(`📦 ${service.serviceName}`);
      console.log(`   References found in: ${service.actualReferences.slice(0, 3).join(', ')}${service.actualReferences.length > 3 ? ` (+${service.actualReferences.length - 3} more)` : ''}`);
      console.log(`   Notes: ${service.notes}\n`);
    }
  }
  
  if (archive.length > 0) {
    console.log('\n🗑️  Services SAFE TO ARCHIVE:');
    console.log('============================');
    for (const service of archive) {
      console.log(`📦 ${service.serviceName}`);
      console.log(`   Notes: ${service.notes}\n`);
    }
  }
  
  if (review.length > 0) {
    console.log('\n🔍 Services needing MANUAL REVIEW:');
    console.log('=================================');
    for (const service of review) {
      console.log(`📦 ${service.serviceName}`);
      console.log(`   Notes: ${service.notes}\n`);
    }
  }
  
  // Save detailed results
  const reportFile = path.join(monorepoRoot, `service-validation-report-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`📄 Detailed report saved to: ${reportFile}`);
}

validateUnusedServices().catch(console.error);