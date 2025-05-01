
/**
 * DEPRECATED - This mock file should not be used anymore.
 * Please use the real SupabaseClientService from packages/shared/services/supabase-client instead.
 * This file is kept for historical purposes but should be removed in a future cleanup.
 */

const { SupabaseClientService: RealSupabaseClientService } = require('../../../../packages/shared/services/supabase-client');

// Just redirect to the real service
const SupabaseClientService = RealSupabaseClientService;

module.exports = { SupabaseClientService };