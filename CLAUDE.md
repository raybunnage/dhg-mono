# Claude Code Instructions

⚠️ **CRITICAL: ALWAYS TEST TYPESCRIPT COMPILATION BEFORE SUBMITTING NEW CODE**
- Run `tsc --noEmit` to check for TypeScript errors in new files
- Explicitly type all parameters and variables to avoid implicit 'any' types
- Never submit code with TypeScript errors

## Code Organization Principles

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
   - Other domain-specific pipelines as they are created
   
   Keep a flat file structure within these folders - no nested subfolders. Don't create new script components in the root `scripts/` directory.

4. **Singleton Pattern for External Services**: Always use the established singleton patterns for external service connections:
   - Supabase: `packages/shared/services/supabase-service`
   - Google Drive: `packages/shared/services/google-drive`
   - Claude AI: `packages/shared/services/claude-service`

5. **Archiving Strategy**: Archive temporary or unused code in `.archived_scripts` folders with the date appended to the filename (e.g., `scripts/cli-pipeline/google_sync/.archived_scripts/some-script.20250330.ts`).

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

3. **Command Implementation Checklist**:
   - Implement full functionality, not just placeholder or mock-up code
   - Avoid "dummy implementations" unless absolutely necessary for testing
   - Include proper error handling and logging
   - Only use dry-run flags for testing potentially destructive operations, not as a substitute for real implementation
   - Test the command with real data before submitting

## Development Workflow

1. **Progressive Enhancement**: 
   - Fix and refactor code incrementally
   - Avoid breaking existing functionality
   - Prefer enhancing CLI pipeline commands over creating standalone scripts

2. **Quality Assurance**:
   - Always test for TypeScript errors after making changes
   - Verify command functionality after fixing errors
   - Document the full paths (from the project root) and arguments needed to run the CLI commands
   - Always test any new commands by running them with appropriate arguments
   - Fix any TypeScript errors before considering a task complete

3. **Version Control**:
   - Make logical commits at appropriate intervals
   - Include descriptive commit messages

## Common Commands 
<!-- Add frequently used commands for build, test, lint, etc. -->

## Project Structure Notes
<!-- Key directories and their purposes -->
- `packages/shared/` - Reusable services and utilities
- `scripts/cli-pipeline/` - Command-line interfaces for major processes
- `apps/dhg-improve-experts/` - Main application UI components

## Continuous Improvement
When I identify recurring patterns, issues, or inefficiencies in the development workflow, I'll document them here along with solutions:

1. **Issue**: Authentication and credential management for external services
   **Solution**: Always use the existing singleton services for authentication
   **Implementation**: 
   - For Supabase access issues, use the singleton in `packages/shared/services/supabase-service/supabase-service.ts` instead of implementing custom authentication
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

6. **Issue**: Multiple implementations of the Claude AI service
   **Solution**: Use the consolidated Claude service
   **Implementation**:
   - Always use `packages/shared/services/claude-service` for all Claude AI interactions
   - Import the singleton instance: `import { claudeService } from '../../packages/shared/services/claude-service'`
   - Never create new implementations or instances of the Claude service
   - Leverage the existing methods for text generation, JSON responses, and classification
   - Refer to the README.md in the claude-service folder for usage examples

## TypeScript Best Practices
⚠️ **ALWAYS CHECK FOR TYPESCRIPT ERRORS BEFORE SUBMITTING CODE**

1. **Type Safety First**:
   - Always use explicit typing for function parameters, variables, and return types
   - Avoid `any` type unless absolutely necessary; prefer unknown with type guards
   - Follow existing type patterns in the codebase
   - Pay special attention to callback parameters in array methods (map, filter, reduce)

2. **TypeScript Validation Command**:
   ```bash
   tsc --noEmit
   ```
   **Always run this command after creating or modifying TypeScript files**

3. **Common TypeScript Issues to Avoid**:
   - Implicit `any` types in parameters and variables
   - Missing return types on functions
   - Incorrect typing of Promise results
   - Forgetting to type array method callbacks
   - Not handling possible undefined/null values

## Database Schema Conventions

1. **Column Naming**:
   - The `document_types` table uses `document_type` as the column name (not `name`)
   - When querying Supabase with nested selects like `document_types(field)`, use the correct column names:
     - CORRECT: `document_types(document_type)`
     - INCORRECT: `document_types(name)`

2. **Table Relationships**:
   - Always verify foreign key relationships and column names before writing queries
   - Refer to existing code to confirm the correct column names for joins and selects
   - Test queries with a small result set before implementing in production code
