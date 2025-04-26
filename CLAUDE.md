# Claude Code Instructions

⚠️ **CRITICAL: CODE REVIEW CHECKLIST**

## BEFORE WRITING ANY CODE:
- Review this CLAUDE.md file completely to understand project standards
- Check if existing shared services can solve the problem (`packages/shared/services`)
- Identify the appropriate location for new code (CLI pipeline, shared services, etc.)
- Check if similar functionality already exists that can be reused
- Look for opportunities to create or enhance singleton services
- Verify which environment variables are needed (always use .env files, never hardcode secrets)
- Ensure database operations will properly handle IDs (never null, use UUIDs)
- Use ONLY `supabase/types.ts` for database schema information (the single source of truth)

## AFTER WRITING CODE BUT BEFORE SUBMITTING:
- Run `tsc --noEmit` to check for TypeScript errors
- Verify all parameters and variables have explicit types (avoid implicit 'any')
- Ensure no hardcoded credentials or secrets exist in the code
- Check if any functionality should be moved to shared services
- Verify CLI commands are properly integrated into the pipeline structure
- Test the code with real data to ensure it works as expected
- For refactored code, thoroughly verify the functionality is unchanged
- If moving functionality to shared services, test both before and after
- Run appropriate tests for both the original behavior and any enhancements

## Code Organization Principles

0. **⚠️ CRITICAL: NEVER ADD FILES TO THE ROOT DIRECTORY**: 
   - ⚠️ **NEVER create any files in the root of the project directory**
   - This includes markdown files, TypeScript/JavaScript files, JSON files, or any other files
   - All new files MUST be placed in the appropriate subdirectory according to their purpose:
     - New services go in `packages/shared/services/`
     - New CLI commands go in `scripts/cli-pipeline/{domain}/`
     - New documentation goes in `docs/{appropriate-category}/`
     - New types go in the appropriate domain-specific types file
   - Root directory clutter makes the project harder to navigate and maintain
   - If you're unsure where a file should go, ask for clarification rather than defaulting to the root
   - When refactoring, move any existing root files to appropriate subdirectories
   
1. **Shared Services First**: Always prioritize using and enhancing the shared services in `packages/shared`. Before implementing any functionality, check if an existing service can be used or extended.
   - Check for existing services in `packages/shared/services` that could solve the problem
   - Consider creating new shared services when implementing functionality that could be reused
   - Avoid duplicating functionality that already exists in shared services
   - When enhancing CLI scripts, first check if the functionality can be implemented by using shared services

2. **UI Pages as Service Sources**: When examining UI pages in `apps/dhg-improve-experts`, treat them as potential sources for shared services. These comprehensive pages often contain functionality that can be abstracted into reusable services. Future refactoring will create "New" + page name versions that leverage these shared services while preserving the React UI components.

3. **CLI Pipeline Architecture**: Organize all command-line interfaces using commander.js in the appropriate CLI pipeline folder:
   - `scripts/cli-pipeline/google_sync/`
   - `scripts/cli-pipeline/document/`
   - `scripts/cli-pipeline/scripts/`
   - `scripts/cli-pipeline/media-processing/`
   - `scripts/cli-pipeline/presentations/`
   - `scripts/cli-pipeline/prompt_service/`
   - Other domain-specific pipelines as they are created
   
   Keep a flat file structure within these folders - no nested subfolders. Don't create new script components in the root `scripts/` directory.
   
   **Commander.js Integration Notes**:
   - ⚠️ **CRITICAL: STANDARDIZE COMMANDER.JS USAGE**
   - All CLI pipelines MUST follow these standards:
     - ALWAYS create a dedicated package.json in each CLI pipeline directory
     - ALWAYS use commander.js v11.0.0 as a local dependency in that package.json
     - Include standardized scripts in package.json (build, start, dev)
   
   - Two acceptable patterns for commander.js integration:
     1. Direct import (simpler, preferred for most cases):
        ```typescript
        import { Command } from 'commander';
        const program = new Command();
        
        program
          .command('command-name')
          .description('Command description')
          .option('-o, --option', 'Option description')
          .action(async (options) => {
            // Command implementation
          });
        ```
     
     2. cliService abstraction (for complex CLI pipelines with shared utilities):
        ```typescript
        import { cliService } from '../../../packages/shared/services/cli-service';
        
        cliService.registerCommand({
          command: 'command-name',
          description: 'Command description',
          options: [
            { flags: '-o, --option', description: 'Option description' }
          ],
          action: async (options) => {
            // Command implementation
          }
        });
        ```
   
   - Package.json template for CLI pipeline directories:
     ```json
     {
       "name": "@dhg/cli-pipeline-domain-name",
       "version": "1.0.0",
       "private": true,
       "dependencies": {
         "commander": "^11.0.0",
         "dotenv": "^16.0.3",
         "typescript": "^5.0.4"
       },
       "scripts": {
         "build": "tsc",
         "start": "ts-node cli.ts",
         "dev": "ts-node cli.ts"
       }
     }
     ```
   
   - CLI Integration Best Practices:
     - Each cli-pipeline directory MUST have its own package.json for dependency management
     - Shell scripts MUST properly export environment variables
     - ALWAYS implement command tracking (see Command Tracking Implementation section)
     - ALWAYS check for proper availability of Supabase credentials
     - For new pipelines, use google_sync or prompt_service as reference implementations

4. **Singleton Pattern for Services**: Always use and create singleton patterns for service classes:
   - ⚠️ **CRITICAL: Use existing singletons for external services**:
     - Supabase: `packages/shared/services/supabase-client.ts`
     - Google Drive: `packages/shared/services/google-drive`
     - Claude AI: `packages/shared/services/claude-service`
   
   - ⚠️ **ALWAYS CREATE SINGLETONS for new services**:
     - When creating any new service class under `packages/shared/services/`
     - Follow the established singleton pattern from existing services
     - Example singleton implementation pattern:
       ```typescript
       export class NewService {
         private static instance: NewService;
         private constructor() {
           // Private constructor to enforce singleton pattern
         }
         
         public static getInstance(): NewService {
           if (!NewService.instance) {
             NewService.instance = new NewService();
           }
           return NewService.instance;
         }
         
         // Service methods go here
       }
       ```
     
   - **PRE-IMPLEMENTATION CHECK**: Before creating a new service, check if an existing singleton can be enhanced
   - **DURING IMPLEMENTATION**: Always implement services as singletons
   - **POST-IMPLEMENTATION CHECK**: Verify your code only accesses services through getInstance()

5. **Archiving Strategy**: Archive temporary or unused code in `.archived_scripts` folders with the date appended to the filename (e.g., `scripts/cli-pipeline/google_sync/.archived_scripts/some-script.20250330.ts`).

6. **Supabase TypeScript Types - SINGLE SOURCE OF TRUTH**:
   - ⚠️ **CRITICAL: There is ONLY ONE canonical types file for database schema**
   - Use ONLY the `supabase/types.ts` file for all database types and table schemas
   - This file is automatically generated from the current Supabase database schema
   - When you need to understand database fields and relationships, ALWAYS consult this file
   - NEVER use any other types.ts files for Supabase types - this is the ONLY source of truth
   - This file is kept up-to-date whenever database schema changes occur
   - When answering questions about database fields, tables, or relationships, refer to this file
 
 7. **Experts Table**:
   - The experts table is a special table that contains the experts for the project
   - it has a one to many relationship with the sources_google table
   - It has an expert_name field which is a short unique name for each expert
   - It also has a full_name field which is the full name of the expert

8. **Document Types**:
   - Document types are a special table that contains the document types for the project
   - it has a field called document_type which is the type of the document - but we use instead of name which seems to confuse you regularly

9. **Using Claude Service - CRITICAL IMPLEMENTATION GUIDELINES**:
   - ⚠️ **DO NOT CREATE NEW INSTANCES** - NEVER use `new ClaudeService()`
   - ⚠️ **ALWAYS USE THE SINGLETON PATTERN** to access Claude:
     ```typescript
     // CORRECT IMPORT - Use this exact path and import
     import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
     
     // CORRECT USAGE - Use the imported singleton directly
     const response = await claudeService.sendPrompt('Your prompt');
     ```
   - When searching for examples, look at these correct implementations:
     - `scripts/cli-pipeline/examples/claude-service-example.ts`
     - `scripts/cli-pipeline/media-processing/commands/process-summary.ts`
     - `scripts/cli-pipeline/presentations/commands/generate-summary.ts`
   - ⚠️ **ERROR HANDLING REQUIREMENTS**:
     - ALWAYS handle errors properly when working with Claude
     - Use try/catch blocks to catch and log errors properly 
     - Provide meaningful error messages that will help users understand what went wrong

10. **Ignore file_types folder off the root**:
   - this folder is for temporary file processing and archiving 
   - you should not be searching or accounting for files in this folder - unless instructed to do so
   
11. **SECURITY: Always use environment variables for secrets**:
   - ⚠️ NEVER hardcode credentials, tokens, or secrets in .ts, .js, or .json files
   - Always retrieve secrets from environment variables (.env.development file)
   - Use the established patterns for accessing environment variables:
     - Server-side/CLI: `process.env.SECRET_NAME`
     - Frontend (Vite): `import.meta.env.VITE_SECRET_NAME`
   - Follow the existing SupabaseClientService pattern for credential management
   - If you see hardcoded secrets in existing code, refactor them to use env variables

12. **REFACTORING: Review code after implementation**:
   - Proactively identify code that should be moved to shared services
   - Refactor immediately when you see duplication or reusable patterns
   - If a CLI command contains logic that could be reused, extract it to a shared service
   - Create new shared services when implementing functionality that doesn't fit existing ones
   - Run TypeScript validation and tests after refactoring

13. **SECURITY VERIFICATION: Final check before submitting**:
   - Verify no credentials, tokens, or API keys are hardcoded in the code
   - Ensure all environment variables are properly documented
   - Avoid committing sensitive files (.env files, credentials, etc.)
   - Double-check all secret handling is done via environment variables
   - Review file paths to ensure no sensitive data is accidentally included

14. **SUPABASE CONNECTIVITY: Standard patterns for database access**:
   - ⚠️ **CRITICAL: ALWAYS use the SupabaseClientService singleton**
   - Located at: `packages/shared/services/supabase-client.ts`
   - Import pattern: `import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';`
   - Usage pattern: `const supabase = SupabaseClientService.getInstance().getClient();`
   - NEVER create your own Supabase client instances or implement custom credential loading
   - Credential loading priority (handled automatically by the service):
     1. Direct extraction from `.env.development` using regex
     2. Configuration object if available
     3. Environment variables loaded via dotenv from multiple files
     4. Various environment variable naming patterns (SUPABASE_URL, VITE_SUPABASE_URL, etc.)
   - Required environment variables in `.env.development`:
     ```
     SUPABASE_URL=https://your-project-id.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
     ```
   - When troubleshooting connectivity issues:
     - Check that `.env.development` exists in the project root
     - Verify it contains the correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
     - Use `process.cwd()` to verify the current working directory
     - Run connection test: `await SupabaseClientService.getInstance().testConnection()`
   - Always handle errors properly:
     ```typescript
     const { data, error } = await supabase.from('table_name').select('*');
     if (error) {
       console.error('Database error:', error);
       return;
     }
     ```


## CLI Pipeline Integration Requirements

1. **Always Integrate New Commands**:
   - EVERY new script or command MUST be integrated into the appropriate CLI pipeline
   - there are often 2 cli pipelines - 1) the The Node.js/TypeScript CLI that you seem to first develop and then  2. A shell script CLI - for examp;le the google-drive-cli.sh (./scripts/cli-pipeline/google_sync/google-drive-cli.sh)
   - I always want you to integrate the new command into the shell script CLI which is the only one I use to actually do the commands with.
   - do not provide me scripts that start with ts-node - instead make this command accessible via the CLI like the other commands,
   we need to make it runnable through the CLI pipeline.
   - Never create standalone scripts outside the pipeline structure
   - Identify the correct domain pipeline for the functionality (document, google_sync, media-processing, presentations, etc.)
   - Add the command to the existing program or create a new subcommand if needed

2. **Command Documentation**:
   - Always add detailed help text to commands using `.description()` and `.option()` methods
   - Ensure the command appears correctly in the pipeline's `--help` output
   - Include examples of usage in the command description
   - Document all available options with clear descriptions

3. **Command Tracking Implementation**:
   - ⚠️ **CRITICAL: ALWAYS implement command tracking for new CLI commands**
   - After adding any new command to a CLI pipeline, implement command tracking using the CommandTrackingService
   - Our standard approach is to implement tracking at the shell script wrapper level
   - ⚠️ **ALWAYS CHECK the shell script wrapper for tracking integration**
   
   - **PREFERRED APPROACH - Shell Script Tracking**:
     - Add new commands to the existing shell script wrapper (e.g., google-sync-cli.sh)
     - Ensure the wrapper already has this track_command() function (all existing pipelines should have it):
       ```bash
       track_command() {
         local pipeline_name="your_pipeline_name"
         local command_name="$1"
         shift
         local full_command="$@"
         
         local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
         if [ -f "$TRACKER_TS" ]; then
           npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
         else
           echo "ℹ️ Tracking not available. Running command directly."
           eval "$full_command"
         fi
       }
       ```
     - Call track_command for each new CLI command in the shell script:
       ```bash
       # Add a new command handler
       your_new_command() {
         track_command "your-new-command" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/your-new-command.ts $@"
       }
       
       # And add it to the case statement
       case "$1" in
         "your-new-command")
           your_new_command "${@:2}"
           ;;
       esac
       ```
       
   - **ALTERNATIVE - Direct TypeScript Tracking**:
     - Use this approach only when implementing standalone TypeScript commands that won't be called through shell wrappers
     - Import and use the CommandTrackingService directly:
       ```typescript
       import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
       
       async function yourCommand() {
         const startTime = new Date();
         const trackingId = await commandTrackingService.startTracking('your_pipeline', 'your_command');
         
         try {
           // Command implementation
           // ...
           
           await commandTrackingService.completeTracking(trackingId, {
             recordsAffected: 123, // optional
             summary: 'Command completed successfully'
           });
         } catch (error) {
           await commandTrackingService.failTracking(
             trackingId,
             `Command failed: ${error instanceof Error ? error.message : String(error)}`
           );
           throw error;
         }
       }
       ```
   
   - **FOR NEW CLI PIPELINES**:
     1. Create the shell script wrapper with track_command function
     2. Copy the structure from an existing pipeline (e.g., google-sync-cli.sh)
     3. Set the correct pipeline_name in the track_command function
     4. Implement command handlers for each TypeScript command
   
   - Command tracking provides:
     - Audit trails of who ran what command and when
     - Performance monitoring of command execution time
     - Identifying frequently used vs. unused commands
     - Diagnosing issues with failed commands
   
   - The `cli_command_tracking` table stores all command execution records
   - You can view command history using the tracking CLI: `scripts/cli-pipeline/tracking/cli.ts history`

4. **Command Implementation Checklist**:
   - Implement full functionality, not just placeholder or mock-up code
   - Avoid "dummy implementations" unless absolutely necessary for testing
   - Include proper error handling and logging
   - Only use dry-run flags for testing potentially destructive operations, not as a substitute for real implementation
   - Test the command with real data before submitting

## Development Workflow

1. **Safe and Incremental Refactoring**: 
   - ⚠️ **CRITICAL: Never break existing functionality during refactoring**
   - Approach refactoring in small, manageable steps:
     1. Understand the existing code thoroughly before changing it
     2. Write tests or create a simple test case for the functionality
     3. Make one small change at a time
     4. Test after each change to verify nothing broke
     5. If something breaks, revert that change and try a different approach
   - Use these safe refactoring techniques:
     - Extract method/function: Move code to a new function without changing behavior
     - Rename variables/functions: Improve naming without altering functionality
     - Extract interface/type: Add TypeScript types without changing runtime behavior
     - Add documentation: Clarify code purpose without changing implementation
   - For larger refactors:
     - Create a temporary branch for experimental changes
     - Write down the steps of your refactoring plan
     - Document the "before" and expected "after" state
     - Test at each intermediate stage
   - When moving code to shared services:
     - First make it work in its original location
     - Then extract it to a shared service
     - Then replace the original with calls to the shared service
     - Test after each step
   - Fix and refactor code incrementally
   - Avoid breaking existing functionality
   - Prefer enhancing CLI pipeline commands over creating standalone scripts

2. **Quality Assurance**:
   - Always test for TypeScript errors after making changes
   - Verify command functionality after fixing errors
   - Document the full paths (from the project root) and arguments needed to run the CLI commands
   - Always test any new commands by running them with appropriate arguments
   - Fix any TypeScript errors before considering a task complete

3. **Version Control and Git Management**:
   - For simple and non-destructive git operations, I can help directly:
     - Committing changes after code updates
     - Creating branches for new features
     - Viewing git status and logs
   - ⚠️ **BEFORE ANY DESTRUCTIVE OPERATIONS**:
     - Always ask for confirmation before force pushing, hard resets, or history rewriting
     - Explain the planned git operations clearly before proceeding
     - Suggest creating backups when appropriate
   - Make logical commits at appropriate intervals
   - Include descriptive commit messages that explain the purpose of changes
   - When committing code changes, run tests first to verify functionality

## Common Commands and Review Checklist
<!-- Add frequently used commands for build, test, lint, etc. -->

⚠️ **ALWAYS EXECUTE THESE CHECKS BEFORE SUBMITTING CODE:**
1. TypeScript validation: `tsc --noEmit`
2. Verify no hardcoded credentials in source files
3. Test CLI command functionality with real data
4. Review code for potential shared service extraction
5. Check environment variable handling

## Project Structure Notes and Code Location Guidelines
<!-- Key directories and their purposes -->
- `packages/shared/` - Reusable services and utilities (✅ PREFERRED location for new functionality)
- `scripts/cli-pipeline/` - Command-line interfaces for major processes (✅ ONLY place for new CLI commands)
- `apps/dhg-improve-experts/` - Main application UI components

## Continuous Improvement
⚠️ **PRE-IMPLEMENTATION AND POST-IMPLEMENTATION VERIFICATION**

⚠️ **CRITICAL: ERROR HANDLING AND COMMUNICATION**
- When encountering errors or issues, DO NOT implement workarounds without explaining the underlying problem
- NEVER create "dummy" implementations or partial solutions to try to make the user happy
- ALWAYS clearly explain what's going wrong, why it's happening, and what options exist
- Let the USER decide how to proceed when there are roadblocks - don't try to hide issues
- When faced with a complex problem:
  1. STOP and think through the problem carefully
  2. Clearly communicate the exact issue you're encountering
  3. Present options for how to proceed (when possible)
  4. Let the user make an informed decision
  5. Implement the chosen solution thoroughly and correctly

When implementing solutions, always check this section for known issues and their solutions. Run through this checklist before and after writing code:

7. **Issue**: Missing ID fields in database records
   **Solution**: Always ensure tables have proper ID fields and use them in inserts
   **Implementation**:
   - ⚠️ **CRITICAL: Every table MUST have an `id` field as the primary key**
   - ⚠️ **CRITICAL: The ID field must NEVER be null in any record**
   - ⚠️ **CRITICAL: Every insert operation MUST include an ID or rely on auto-generation**
   - For new tables, always include:
     ```sql
     id uuid default gen_random_uuid() primary key NOT NULL
     ```
   - When inserting records, either:
     - Let the database auto-generate IDs (preferred):
       ```typescript
       const { data, error } = await supabase
         .from('table')
         .insert({ 
           field1: value1,
           field2: value2
           // id will be auto-generated
         })
         .select()
       ```
     - Or explicitly provide UUIDs if needed:
       ```typescript
       import { v4 as uuidv4 } from 'uuid';
       
       const { data, error } = await supabase
         .from('table')
         .insert({
           id: uuidv4(), // explicitly set UUID
           field1: value1,
           field2: value2
         })
         .select()
       ```
   - Common pitfalls to avoid:
     - ❌ Never omit the ID field in table definitions
     - ❌ Never insert a record without ensuring it will have an ID
     - ❌ Never allow NULL values for ID fields
     - ❌ Don't use sequential IDs (use UUIDs)
     - ✅ Always include `.select()` after insert to get the generated ID
     - ✅ Check that ID was generated in error handling
   - When writing migrations, ensure ID field is first column defined
   - For existing tables missing IDs, create migration to add UUID primary key
   - **PRE-IMPLEMENTATION CHECK**: Before writing any database code, verify table has proper ID field
   - **POST-IMPLEMENTATION CHECK**: After writing insert operations, verify ID field is properly handled

7. **Issue**: Direct PSQL queries to Supabase database
   **Solution**: Use established CLI pipeline patterns for Supabase interactions
   **Implementation**:
   - Never use direct PSQL queries or psql command line tool to interact with Supabase
   - Instead, look at successful examples in the CLI pipeline:
     - `scripts/cli-pipeline/document/process-documents.ts` - Uses SupabaseClientService for document operations
     - `scripts/cli-pipeline/presentations/sync-presentations.ts` - Shows proper pattern for batch updates
     - `scripts/cli-pipeline/google_sync/sync-folders.ts` - Demonstrates correct transaction handling
   - Always use the singleton SupabaseClientService:
     ```typescript
     import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
     const supabase = SupabaseClientService.getInstance();
     ```
   - Follow established patterns for:
     - Querying data: `supabase.from('table').select()`
     - Inserting records: `supabase.from('table').insert()`
     - Updating records: `supabase.from('table').update()`
     - Transaction handling: Use the service's transaction methods
   - Leverage existing utility functions in shared services rather than writing raw SQL
   - When adding new query patterns, contribute them to the shared service layer for reuse

1. **Issue**: Authentication and credential management for external services
   **Solution**: Always use the existing singleton services for authentication
   **Implementation**: 
   - For Supabase access issues, use the singleton in `packages/shared/services/supabase-client.ts` instead of implementing custom authentication
   - For Google Drive access issues, use the authentication singleton in `packages/shared/services/google-drive` which handles token management and authentication flows
   - Never implement custom authentication logic or hardcode credentials
   - If encountering authentication errors, look for the established patterns in the shared services first

2. **Issue**: Temporary dummy implementations in services
   **Solution**: Fix the underlying database issues rather than using dummy implementations
   **Implementation**:
   - Messages like "Using direct implementation instead of database function" and "Synchronization complete (dummy implementation)" indicate workarounds
   - Instead of these temporary solutions, properly fix the database schema, migrations, and functions
   - When encountering issues with database columns or functions, create proper migrations that can be applied to all environments
   - Prioritize fixing SQL functions and views in the database over workarounds in TypeScript code

3. **Issue**: Overstepping requested tasks
   **Solution**: Adhere strictly to what is explicitly requested
   **Implementation**:
   - Only execute the exact commands requested by the user
   - Don't automatically run follow-up actions or suggest next steps unless explicitly asked
   - For CLI operations, prefer dry-run flags when testing changes
   - When fixing bugs, focus solely on the specific issue without expanding scope
   - Always ask before taking additional actions beyond what was explicitly requested
   - When asked to modify code for preparation, don't automatically execute the prepared code

4. **Issue**: Creating standalone scripts or dummy implementations
   **Solution**: Always create real implementations integrated into CLI pipelines
   **Implementation**:
   - Never create standalone scripts outside of CLI pipeline structure
   - Implement full, working functionality rather than mock-ups or dummy implementations
   - Always test new commands with real data before considering implementation complete
   - Only use dry-run flags for testing potentially destructive operations, not as a substitute for implementation
   - Always run and fix TypeScript errors before submitting any new code

5. **Issue**: Duplicating functionality that exists in shared services
   **Solution**: Always check shared services before implementing new functionality
   **Implementation**:
   - Before adding functionality to CLI pipelines, check if it exists in `packages/shared/services`
   - Consider whether new functionality should be implemented as a shared service instead of directly in the CLI
   - Extract common functionality from CLI implementations into shared services when appropriate
   - Follow the existing patterns for service implementation and consumption

5a. **Issue**: Not using the singleton pattern for services
   **Solution**: Always implement services as singletons and look for opportunities to create them
   **Implementation**:
   - ⚠️ When you see a class or group of functions that manage state or provide utility methods:
     - Consider extracting it to a singleton service in `packages/shared/services/`
     - Follow the singleton pattern shown in section 4 of Code Organization Principles
   - Look for these signs that code should be a singleton service:
     - Functions that share configuration or state
     - Repeated initialization of connection to external services
     - Utility functions grouped by domain (e.g., file operations, data transformations)
     - Classes instantiated multiple times with the same configuration
   - **PRE-IMPLEMENTATION CHECK**: Is there shared state or configuration that should be managed in one place?
   - **POST-IMPLEMENTATION CHECK**: Have you converted appropriate utility functions into singleton services?

6. **Issue**: Multiple implementations of the Claude AI service
   **Solution**: Use the consolidated Claude service
   **Implementation**:
   - ⚠️ **CRITICAL: ALWAYS use the correct singleton import path and pattern:**
     ```typescript
     import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
     ```
   - ⚠️ **CRITICAL: NEVER create new instances with `new ClaudeService()`**
   - ⚠️ **CRITICAL: ALWAYS use the imported singleton directly:**
     ```typescript
     // CORRECT
     const response = await claudeService.sendPrompt('Your prompt');
     
     // WRONG - Do not create new instances!
     const claudeInstance = new ClaudeService(); // WRONG!
     const response = await claudeInstance.sendPrompt('Your prompt'); // WRONG!
     ```
   - When implementing new Claude integrations, first examine working examples:
     - `scripts/cli-pipeline/examples/claude-service-example.ts`
     - `scripts/cli-pipeline/media-processing/commands/process-summary.ts`
   - Handle errors properly with try/catch blocks and meaningful error messages
   - Use explicit TypeScript types for Claude method parameters and return values
   - Test your Claude integration with small inputs before processing large content

## TypeScript Best Practices
⚠️ **TYPESCRIPT VERIFICATION WORKFLOW**

1. **BEFORE WRITING CODE**:
   - Review existing type patterns in similar files
   - Identify which types will be needed from shared/supabase types
   - Plan how to handle undefined/null values
   - Check if generics would improve type safety for the solution

2. **DURING IMPLEMENTATION**:
   - Explicitly type ALL function parameters, variables, and return types
   - Avoid `any` type; use `unknown` with type guards instead
   - Type all callback parameters in array methods (map, filter, reduce)
   - Use proper Promise typing (Promise<T>)
   - Follow existing type patterns in the codebase
   - Handle all possible undefined/null values properly

3. **AFTER IMPLEMENTATION BUT BEFORE SUBMISSION**:
   ```bash
   tsc --noEmit
   ```
   - Run this command to validate TypeScript in your changes
   - Fix ALL TypeScript errors before submitting code
   - Review type definitions for any potential improvements
   - Check error handling for type safety

4. **COMMON TYPESCRIPT ISSUES TO CHECK FOR**:
   - Implicit `any` types in parameters and variables
   - Missing return types on functions
   - Incorrect typing of Promise results
   - Untyped array method callbacks
   - Unhandled undefined/null values
   - Improper type assertions
   - Missing generic type parameters

## Database Schema Conventions
  
1. **BEFORE WRITING DATABASE CODE**:
   - ⚠️ **CRITICAL: Always consult `supabase/types.ts` for database schema information**
   - This is the ONLY source of truth for table fields, types, and relationships
   - DO NOT rely on inspecting other code to determine schema - always check the types file
   - Always verify table and column names in this file before writing queries
   - Understand the relationships between tables as defined in the types
   - Use the SupabaseClientService singleton pattern for database access
   - Plan how to handle database errors

2. **COLUMN NAMING VERIFICATION**:

   - The `experts` table uses `expert_name` as column name:
     - When querying with nested selects:
       - ✅ CORRECT: `experts(expert_name)`
       - ❌ INCORRECT: `experts(name)`

   - The `document_types` table uses `document_type` as column name:
     - When querying with nested selects:
       - ✅ CORRECT: `document_types(document_type)` 
       - ❌ INCORRECT: `document_types(name)`

3. **TABLE RELATIONSHIPS**:
   - Always verify foreign key relationships before writing queries
   - Refer to existing code to confirm correct column names for joins and selects
   - Use TypeScript types from supabase.types.ts to guide your queries
   - Test queries with a small result set before implementing in production code

4. **AFTER WRITING DATABASE CODE**:
   - Check for proper error handling on all database operations
   - Verify that IDs are properly managed (use UUIDs, not sequential IDs)
   - Ensure all insert operations include `.select()` to return generated IDs
   - Test database operations with real data
   - Check for any hardcoded credentials or connection strings
# Claude Service Standard Implementation

This repository uses a singleton instance of the Claude service for all Claude AI interactions.

## How to Use Claude Service

1. Import the singleton instance:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service';
```

2. Use the appropriate methods:
```typescript
// For simple text responses
const textResponse = await claudeService.sendPrompt('Your prompt here');

// For structured JSON responses
const jsonResponse = await claudeService.getJsonResponse('Your prompt here');

// For PDF processing
const pdfContent = await claudeService.analyzePdf('/path/to/file.pdf', 'Your prompt here');
const pdfJson = await claudeService.analyzePdfToJson('/path/to/file.pdf', 'Your prompt here');
```

3. Never create new instances with 'new ClaudeService()'. Always use the singleton.

## Available Methods

- sendPrompt: Get a text response
- getJsonResponse: Get a structured JSON response
- classifyText: Classify text content
- analyzePdf: Process a PDF file and return text
- analyzePdfToJson: Process a PDF file and return JSON

## PDF Processing

The Claude service supports processing PDFs and will automatically:
- Handle large PDFs by splitting them
- Convert PDFs to Claude's required format
- Return either text or structured JSON

