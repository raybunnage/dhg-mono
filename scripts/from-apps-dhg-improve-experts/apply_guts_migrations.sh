#!/bin/bash
# Script to apply Guts dashboard migrations

echo "Starting Guts dashboard migration process..."

# Navigate to the root directory
cd ../../

echo "Applying migration: 20250301000004_add_guts_dashboard_tables.sql"
pnpm supabase migration up 20250301000004_add_guts_dashboard_tables.sql

echo "Migrations applied successfully!"

# Return to the app directory
cd apps/dhg-improve-experts

echo "Done! You can now use the Guts dashboard feature." 