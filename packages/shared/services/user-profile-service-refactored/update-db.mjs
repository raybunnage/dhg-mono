/**
 * Database update script for UserProfileService refactoring
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

async function updateUserProfileServiceRecord() {
  console.log('Updating UserProfileService database record...');

  const { error } = await supabase
    .from('sys_shared_services')
    .update({
      migration_status: 'completed',
      migration_completed_at: new Date().toISOString(),
      base_class_type: 'BusinessService',
      instantiation_pattern: 'dependency_injection',
      breaking_changes: true,
      backwards_compatible: false,
      updated_at: new Date().toISOString(),
      migration_notes: 'Refactored from singleton to BusinessService with dependency injection. Major breaking change requiring SupabaseClient dependency. Added comprehensive metrics, health checks, and structured logging for user profile management.',
      performance_after: 'improved_metrics_health_checks_structured_logging'
    })
    .eq('service_name', 'UserProfileService');

  if (error) {
    console.error('❌ Error updating UserProfileService record:', error);
    process.exit(1);
  }

  console.log('✅ UserProfileService database record updated successfully');
}

updateUserProfileServiceRecord();