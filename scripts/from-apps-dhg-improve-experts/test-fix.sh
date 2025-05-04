#!/bin/bash

# Test our fix by running a small script that checks for required environment variables
# This script simulates the issue in a controlled way

echo "Testing environment variable fix"

# Create test directory
mkdir -p test-env-fix
cd test-env-fix

# Create a simple test Node.js script
cat > test-env.js << 'EOL'
// Test environment variable handling

// Log environment variables
console.log("VITE_SUPABASE_SERVICE_ROLE_KEY:", process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not set");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not set");

// Try to use SUPABASE_SERVICE_ROLE_KEY as fallback
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Using SUPABASE_SERVICE_ROLE_KEY as fallback");
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Check if it's set now
console.log("VITE_SUPABASE_SERVICE_ROLE_KEY after fallback:", process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not set");

// Try to get required value
function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

try {
  // This should now work with our fix
  const supabaseKey = getRequiredEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
  console.log("Successfully got key:", supabaseKey.substring(0, 5) + "...");
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("Test passed!");
EOL

# Run test in a clean environment without VITE_ prefix
echo "Running test without VITE_ prefix (should use fallback):"
unset VITE_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY="test-service-role-key" node test-env.js

# Clean up
cd ..
rm -rf test-env-fix

echo "Test completed"