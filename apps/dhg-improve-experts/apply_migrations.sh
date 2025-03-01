#!/bin/bash

# Script to apply Supabase migrations

echo "Applying Supabase migrations..."

# Navigate to the root directory
cd ../../

# Apply the migrations
echo "Applying migration: 20250301000001_update_experts_rls_policy.sql"
pnpm supabase migration up 20250301000001_update_experts_rls_policy.sql

echo "Applying migration: 20250301000002_add_rls_check_functions.sql"
pnpm supabase migration up 20250301000002_add_rls_check_functions.sql

echo "Applying migration: 20250301000003_add_execute_sql_function.sql"
pnpm supabase migration up 20250301000003_add_execute_sql_function.sql

echo "Migrations applied successfully!"

# Return to the app directory
cd apps/dhg-improve-experts 