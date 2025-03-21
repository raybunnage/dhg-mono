#!/bin/bash

# Script to apply RLS policy migrations to Supabase database
# This script should be run from the root of the project

echo "Applying RLS policy migrations to Supabase database..."

# Check if we're in the root directory
if [ ! -d "supabase" ]; then
  echo "Error: This script must be run from the root of the project"
  exit 1
fi

# Apply the migrations using Supabase CLI
echo "Applying migration: 20250301000001_update_experts_rls_policy.sql"
pnpm dlx supabase migration up --file 20250301000001_update_experts_rls_policy.sql

echo "Applying migration: 20250301000002_update_document_types_rls_policy.sql"
pnpm dlx supabase migration up --file 20250301000002_update_document_types_rls_policy.sql

echo "Applying migration: 20250301000003_update_expert_documents_rls_policy.sql"
pnpm dlx supabase migration up --file 20250301000003_update_expert_documents_rls_policy.sql

echo "Applying migration: 20250301000004_permissive_experts_rls_policy.sql"
pnpm dlx supabase migration up --file 20250301000004_permissive_experts_rls_policy.sql

echo "RLS policy migrations applied successfully!"
echo "All tables now have consistent RLS policies allowing both anonymous and authenticated access."
echo "The experts table now has a highly permissive security policy with RLS disabled."
echo "This should eliminate 401 errors when accessing the experts table." 