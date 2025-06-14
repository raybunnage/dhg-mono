/**
 * Database update script for UnifiedClassificationService refactoring
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.development' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.development');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateUnifiedClassificationServiceRecord() {
  console.log('Updating UnifiedClassificationService database record...');

  const { error } = await supabase
    .from('sys_shared_services')
    .update({
      refactored: true,
      refactored_date: new Date().toISOString(),
      migration_status: 'completed',
      health_check_enabled: true,
      metrics_enabled: true,
      structured_logging_enabled: true,
      dependency_injection: true,
      base_class: 'BusinessService',
      updated_at: new Date().toISOString(),
      notes: 'Refactored from singleton to BusinessService with dependency injection. Major breaking change requiring configuration object with all service dependencies. Added comprehensive metrics, health checks, and structured logging.'
    })
    .eq('service_name', 'UnifiedClassificationService');

  if (error) {
    console.error('❌ Error updating UnifiedClassificationService record:', error);
    process.exit(1);
  }

  console.log('✅ UnifiedClassificationService database record updated successfully');
}

updateUnifiedClassificationServiceRecord();