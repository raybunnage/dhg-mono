# PostgreSQL Function Export System

This system allows you to export all PostgreSQL functions from your Supabase database to a JSON file, making it easier to document, search, and reference database functions in your codebase.

## Components

1. **Database Migration**: Creates a PostgreSQL function that exports all functions as JSON
2. **Export Script**: Node.js script that calls the database function and saves the output to a file
3. **Search Script**: Node.js script that searches the exported JSON file for specific functions
4. **Type Generation Script**: Node.js script that generates TypeScript interfaces from the exported functions
5. **Check Script**: Node.js script that checks if the export function is installed in the database

## Setup

### 1. Set Environment Variables

The scripts require Supabase connection details. You can add these to any of the following `.env` files:

- Root `.env` file: `/Users/raybunnage/Documents/github/dhg-mono/.env`
- App-specific `.env` files:
  - `/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/.env`
  - `/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-hub-lovable/.env`
  - `/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-a/.env`
  - `/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-b/.env`

Add the following variables to one of these files:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Check if the Export Function is Installed

Before exporting functions, check if the export function is installed in your database:

```bash
# Check if the export function is installed
pnpm db:check-export-function
```

If the function is not installed, you'll need to apply the migration.

### 3. Apply the Database Migration

The migration creates a PostgreSQL function called `export_all_functions_to_json()` that retrieves metadata about all functions in the database.

```bash
# Run the migration to create the function
pnpm db:migrate
```

### 4. Export Functions

After applying the migration, you can export all functions to a JSON file:

```bash
# Export all functions to supabase/functions.json
pnpm db:export-functions

# Export to a custom location
pnpm db:export-functions ../custom/path/functions.json
```

The script will verify that the file was created successfully and report its size. You should see output like:

```
Successfully exported 42 functions to /Users/raybunnage/Documents/github/dhg-mono/supabase/functions.json
Output file created: /Users/raybunnage/Documents/github/dhg-mono/supabase/functions.json (24 KB)
File verification successful. The export completed successfully.
```

### 5. Search Functions

Once you've exported the functions, you can search for specific functions:

```bash
# Search for functions related to "documentation"
pnpm db:search-functions documentation

# Search for functions related to "command"
pnpm db:search-functions command
```

### 6. Generate TypeScript Interfaces

You can generate TypeScript interfaces for the exported functions:

```bash
# Generate TypeScript interfaces using default paths
pnpm db:generate-function-types

# Generate TypeScript interfaces with custom input and output paths
pnpm db:generate-function-types ../supabase/functions.json ../apps/dhg-improve-experts/src/types/dbFunctions.ts
```

## Function Details

The exported JSON contains detailed information about each function:

- **schema**: Schema name (e.g., "public")
- **name**: Function name
- **arguments**: Function arguments with types
- **return_type**: Function return type
- **body**: Complete function body/implementation
- **description**: Function description (from comments)
- **volatility**: Function volatility (IMMUTABLE, STABLE, VOLATILE)
- **owner**: Function owner
- **security_definer**: Whether the function runs with definer's privileges

## Use Cases

- **Documentation**: Generate comprehensive documentation of database functions
- **Code Generation**: Use function signatures to generate TypeScript interfaces
- **AI Assistance**: Provide context to AI tools about available database functions
- **Dependency Analysis**: Identify function dependencies and relationships
- **Auditing**: Review function security settings and permissions

## Scripts

### Export Script (`scripts/export-db-functions.js`)

Node.js script that calls the `export_all_functions_to_json()` function and saves the output to a file.

### Search Script (`scripts/search-db-functions.js`)

Node.js script that searches the exported JSON file for functions matching a search term.

### Type Generation Script (`scripts/generate-function-types.js`)

Node.js script that generates TypeScript interfaces for function parameters and return types based on the exported functions.

### Check Script (`scripts/check-export-function.js`)

Node.js script that checks if the export function is installed in the database.

## Generated TypeScript Interfaces

The type generation script creates the following TypeScript interfaces:

- **{schema}_{function}Params**: Interface for function parameters
- **{schema}_{function}Result**: Type for function return value
- **DbFunctions**: Interface mapping all database functions to their parameter and return types

Example usage of generated types:

```typescript
import { public_get_command_history_by_categoryParams, public_get_command_history_by_categoryResult } from '../types/dbFunctions';

// Use the parameter interface
const params: public_get_command_history_by_categoryParams = {
  category_id: 1,
  limit: 10,
  offset: 0
};

// Use the return type
const result: public_get_command_history_by_categoryResult = await supabase
  .rpc('get_command_history_by_category', params);
```

## Environment Variables

The scripts require the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin access)

These can be defined in any of the `.env` files mentioned in the Setup section. The scripts will automatically look for these variables in multiple locations.

## Maintenance

If you make changes to the database function export system:

1. Create a new migration with the changes
2. Update the export and search scripts as needed
3. Document the changes in this README

## Troubleshooting

- **Function Not Found**: Run `pnpm db:check-export-function` to check if the function is installed. If not, run `pnpm db:migrate` to install it.
- **Environment Variables Not Found**: Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in one of the `.env` files.
- **Permission Denied**: Check that the service role key has appropriate permissions.
- **Empty JSON**: Verify that your database contains functions to export.
- **Type Generation Errors**: Check that the functions.json file exists and contains valid data.
- **Punycode Deprecation Warnings**: These warnings are automatically suppressed by the scripts. They're related to an internal Node.js module and don't affect functionality.
- **File Not Generated**: The export script now verifies file creation and reports the file size. If you don't see the verification message, check the error output for details.

## Verifying Script Success

To verify that the export script worked correctly:

1. Check the console output for the verification message:
   ```
   Output file created: /path/to/functions.json (XX KB)
   File verification successful. The export completed successfully.
   ```

2. Manually check if the file exists:
   ```bash
   ls -la supabase/functions.json
   ```

3. Check the file content:
   ```bash
   head -n 20 supabase/functions.json
   ```

If the file doesn't exist or is empty, run the check script to verify that the database function is installed:
```bash
pnpm db:check-export-function
``` 