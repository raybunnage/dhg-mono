#!/bin/bash

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Export Supabase environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Check if tables exist, otherwise suggest applying migrations
echo "Checking if filter tables exist..."
CHECK_RESULT=$(npx ts-node <<EOF
import { SupabaseClientService } from '${PROJECT_ROOT}/packages/shared/services/supabase-client';

async function checkTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { error } = await supabase.from('user_filter_profiles').select('id').limit(1);
  return error && error.code === '42P01' ? 'not_exists' : 'exists';
}

checkTables().then(result => console.log(result));
EOF
)

if [ "$CHECK_RESULT" == "not_exists" ]; then
  echo "Filter tables do not exist. Please run migrations first:"
  echo "  cd $PROJECT_ROOT/scripts/cli-pipeline/drive_filter"
  echo "  ./drive-filter-cli.sh apply-migrations"
  exit 1
fi

# Run the example
echo "Running filter query example..."
npx ts-node "$SCRIPT_DIR/filter-query-example.ts"