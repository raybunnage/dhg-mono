# Claude Code Instructions

⚠️ **CRITICAL: ALWAYS TEST TYPESCRIPT COMPILATION BEFORE SUBMITTING NEW CODE**
- Run `tsc --noEmit` to check for TypeScript errors in new files
- Explicitly type all parameters and variables to avoid implicit 'any' types
- Never submit code with TypeScript errors

## Code Organization Principles

1. **Shared Services First**: Always prioritize using and enhancing the shared services in `packages/shared`. Before implementing any functionality, check if an existing service can be used or extended.

2. **UI Pages as Service Sources**: When examining UI pages in `apps/dhg-improve-experts`, treat them as potential sources for shared services. These comprehensive pages often contain functionality that can be abstracted into reusable services. Future refactoring will create "New" + page name versions that leverage these shared services while preserving the React UI components.

3. **CLI Pipeline Architecture**: Organize all command-line interfaces using commander.js in the appropriate CLI pipeline folder:
   - `scripts/cli-pipeline/google_sync/`
   - `scripts/cli-pipeline/document/`
   - `scripts/cli-pipeline/scripts/`
   
   Keep a flat file structure within these folders - no nested subfolders. Don't create new script components in the root `scripts/` directory.

4. **Singleton Pattern for External Services**: Always use the established singleton patterns for external service connections:
   - Supabase: `packages/shared/services/supabase-service`
   - Google Drive: `packages/shared/services/google-drive`

5. **Archiving Strategy**: Archive temporary or unused code in `.archived_scripts` folders with the date appended to the filename (e.g., `scripts/cli-pipeline/google_sync/.archived_scripts/some-script.20250330.ts`).

## Development Workflow

1. **Progressive Enhancement**: 
   - Fix and refactor code incrementally
   - Avoid breaking existing functionality
   - Prefer enhancing CLI pipeline commands over creating standalone scripts

2. **Quality Assurance**:
   - Always test for TypeScript errors after making changes
   - Verify command functionality after fixing errors
   - Document the full paths (from the project root) and arguments needed to run the CLI commands

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
