#!/bin/bash

# Script to set up the CLI package structure in a pnpm monorepo
# Run this from the root of your monorepo

set -e  # Exit on any error

echo "Setting up CLI package structure..."

# 1. Create the packages directory if it doesn't exist
mkdir -p packages/cli/src

# 2. Create the necessary subdirectories in the new CLI package
mkdir -p packages/cli/src/{commands,services,models,utils}

# 3. Copy the existing CLI structure from the app to the packages directory
if [ -d "apps/dhg-improve-experts/scripts/cli/src" ]; then
  echo "Copying existing CLI code..."
  cp -r apps/dhg-improve-experts/scripts/cli/src/* packages/cli/src/
else
  echo "Warning: Existing CLI code not found at apps/dhg-improve-experts/scripts/cli/src"
  echo "Creating basic structure only."
fi

# 4. Create a package.json for the CLI package
echo "Creating package.json..."
cat > packages/cli/package.json << 'EOF'
{
  "name": "@dhg/cli",
  "version": "1.0.0",
  "description": "CLI tools for DHG monorepo",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc -w",
    "lint": "eslint src --ext .ts",
    "start": "ts-node src/index.ts"
  },
  "dependencies": {
    "commander": "^9.4.0",
    "dotenv": "^16.0.3",
    "@supabase/supabase-js": "^2.10.0",
    "axios": "^1.3.4",
    "winston": "^3.8.2"
  },
  "devDependencies": {
    "@types/node": "^18.14.6",
    "typescript": "^4.9.5",
    "ts-node": "^10.9.1",
    "eslint": "^8.35.0"
  }
}
EOF

# 5. Create a tsconfig.json for the CLI package
echo "Creating tsconfig.json..."
cat > packages/cli/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# 6. Create a README.md for the CLI package
echo "Creating README.md..."
cat > packages/cli/README.md << 'EOF'
# DHG CLI Tools

This package contains CLI tools for the DHG monorepo, including:

- Documentation processing
- Script analysis
- Asset validation

## Usage

From the root of the monorepo:

```bash
# Build the CLI
pnpm cli:build

# Run a command
pnpm cli <command> [options]
```

## Available Commands

- `documentation-processor`: Process documentation files
- `validate-assets`: Validate required assets
- `analyze-script`: Analyze script files
EOF

# 7. Update the root package.json
echo "Updating root package.json..."
# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found in the current directory."
  exit 1
fi

# Manually update package.json to avoid dependencies on jq
# Create a temporary file
TMP_FILE=$(mktemp)

# Read the package.json line by line
while IFS= read -r line; do
  # Write the line to the temporary file
  echo "$line" >> "$TMP_FILE"
  
  # Check if this is the workspaces line
  if [[ "$line" =~ \"workspaces\" ]]; then
    # Check if the next line contains the opening bracket
    read -r next_line
    echo "$next_line" >> "$TMP_FILE"
    
    if [[ "$next_line" =~ \[ ]]; then
      # Add packages/cli to the workspaces array if it's not already there
      if ! grep -q "packages/cli" package.json; then
        # Check if there are other entries (comma at the end)
        if [[ "$next_line" =~ \[\ *\" ]]; then
          # There are other entries, add with comma
          echo "    \"packages/cli\"," >> "$TMP_FILE"
        else
          # This is the first entry
          echo "    \"packages/cli\"" >> "$TMP_FILE"
        fi
      fi
    fi
  fi
  
  # Check if this is the scripts section
  if [[ "$line" =~ \"scripts\" ]]; then
    # Read the next line (opening brace)
    read -r next_line
    echo "$next_line" >> "$TMP_FILE"
    
    # Add our CLI scripts
    echo "    \"cli:build\": \"pnpm --filter @dhg/cli build\"," >> "$TMP_FILE"
    echo "    \"cli:dev\": \"pnpm --filter @dhg/cli dev\"," >> "$TMP_FILE"
    echo "    \"cli\": \"pnpm --filter @dhg/cli start\"," >> "$TMP_FILE"
  fi
done < "package.json"

# Check if we successfully processed the file
if [ -s "$TMP_FILE" ]; then
  # Backup the original package.json
  cp package.json package.json.bak
  
  # Replace the original with our modified version
  mv "$TMP_FILE" package.json
  
  echo "Updated package.json and created backup at package.json.bak"
else
  echo "Error: Failed to update package.json"
  rm "$TMP_FILE"
  exit 1
fi

echo "CLI package setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'pnpm install' to install dependencies"
echo "2. Run 'pnpm cli:build' to build the CLI package"
echo "3. Run 'pnpm cli <command>' to use the CLI"
echo ""
echo "Note: You may need to manually adjust the package.json if the automatic updates didn't work correctly." 