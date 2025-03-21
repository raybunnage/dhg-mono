#!/bin/bash

# Script to apply the execute_sql RPC function to Supabase

echo "Applying execute_sql RPC function to Supabase..."

# Check if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  # Try to load from .env file
  if [ -f .env ]; then
    echo "Loading environment from .env file..."
    source .env
  fi
  
  # Try to load from .env.local file
  if [ -f .env.local ]; then
    echo "Loading environment from .env.local file..."
    source .env.local
  fi
fi

# Check again if variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"
  exit 1
fi

# Apply the migration using the Supabase CLI or curl
# Option 1: Using curl to execute the SQL directly
SQL_FILE="sql/add_execute_sql_rpc.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file $SQL_FILE not found"
  exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

# Use curl to execute the SQL via the REST API
echo "Executing SQL via Supabase REST API..."
RESPONSE=$(curl -s -X POST \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$SQL_CONTENT\"}" \
  "$SUPABASE_URL/rest/v1/rpc/execute_sql" || echo "Failed to execute SQL")

if [[ "$RESPONSE" == *"error"* ]]; then
  echo "Error in SQL execution response: $RESPONSE"
  
  # If execute_sql doesn't exist yet, use the alternative approach with multiple statements
  echo "Trying alternative approach for initial setup..."
  
  # This endpoint supports single SQL statements, so we need to split the file
  for statement in $(cat "$SQL_FILE" | tr -d '\n' | sed 's/;/;�/g' | tr '�' '\n'); do
    if [ -n "$statement" ]; then
      echo "Executing statement: ${statement:0:50}..."
      RESP=$(curl -s -X POST \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$statement\"}" \
        "$SUPABASE_URL/rest/v1/sql" || echo "Failed to execute SQL")
      
      if [[ "$RESP" == *"error"* ]]; then
        echo "Warning: Statement execution received error: $RESP"
      fi
    fi
  done
  
  echo "Alternative approach completed."
else
  echo "SQL execution successful via RPC."
fi

echo "Checking if execute_sql function exists..."
CHECK_RESPONSE=$(curl -s -X POST \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'execute_sql' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))\"}" \
  "$SUPABASE_URL/rest/v1/sql")

if [[ "$CHECK_RESPONSE" == *"true"* ]]; then
  echo "Success: execute_sql function is now available in your Supabase project."
  
  # Test the function
  echo "Testing execute_sql function with a simple query..."
  TEST_RESPONSE=$(curl -s -X POST \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"SELECT 'It works!' as message\"}" \
    "$SUPABASE_URL/rest/v1/rpc/execute_sql")
  
  echo "Test response: $TEST_RESPONSE"
else
  echo "Error: execute_sql function was not created successfully."
  exit 1
fi

echo "Done!"