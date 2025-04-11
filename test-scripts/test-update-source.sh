#!/bin/bash

# This script tests the update-sources-from-json.ts script with a specific drive ID
# to verify that parent_folder_id and path_depth are correctly updated.

# Run the script with the specific drive ID mentioned in the issue
# Drive ID: 1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3

cd "$(dirname "$0")/.."

# Make sure the environment is loaded
if [ -f .env ]; then
  source .env
fi

# First, show current record details
echo "Current record details for 1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3:"
echo "-----------------------------------------------------------------"
npx ts-node -e "
const { SupabaseClientService } = require('./packages/shared/services/supabase-client');
async function checkRecord() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data, error } = await supabase
    .from('sources_google2')
    .select('*')
    .eq('drive_id', '1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3')
    .single();
  
  if (error) {
    console.error('Error fetching record:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}
checkRecord();
"

# Run the update with verbose output and specific drive ID
echo ""
echo "Running update for drive ID 1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3..."
echo "-----------------------------------------------------------------"
node_modules/.bin/ts-node scripts/cli-pipeline/google_sync/index.ts update-sources-from-json --verbose --drive-id=1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3

# Check the record after update
echo ""
echo "Record details after update:"
echo "-----------------------------------------------------------------"
npx ts-node -e "
const { SupabaseClientService } = require('./packages/shared/services/supabase-client');
async function checkRecord() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data, error } = await supabase
    .from('sources_google2')
    .select('*')
    .eq('drive_id', '1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3')
    .single();
  
  if (error) {
    console.error('Error fetching record:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}
checkRecord();
"