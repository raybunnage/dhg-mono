# Command History Tracking System

This system tracks and analyzes command execution history, providing insights into command usage patterns, success rates, and suggestions for frequently used commands.

## Features

- **Command History Logging**: Automatically logs executed commands with metadata such as execution time, duration, and exit code
- **Command Sanitization**: Removes sensitive information from commands before storing them
- **Command Categories**: Organizes commands into categories for better organization
- **Favorite Commands**: Save frequently used commands for quick access
- **Command Analytics**: Provides insights into command usage patterns and success rates
- **Command Suggestions**: Suggests commands based on usage patterns and success rates

## Database Structure

The system uses the following tables:

- `command_categories`: Stores command categories
- `command_history`: Logs executed commands with metadata
- `favorite_commands`: Stores favorite commands
- `command_patterns`: Defines patterns for sanitizing sensitive information
- `command_suggestions` (view): Provides command suggestions based on usage patterns

## Setup

### 1. Run Database Migrations

Run the following migration files to set up the database schema:

```bash
# Create tables
pnpm supabase migration up 20250601000000_create_command_history_tables.sql

# Create analytics functions
pnpm supabase migration up 20250601000001_create_command_analytics_functions.sql
```

### 2. Install Dependencies

```bash
# From the repository root
pnpm add -w dotenv @supabase/supabase-js
pnpm add -Dw ts-node typescript @types/node
```

### 3. Configure Environment Variables

Create a `.env` file in the repository root with the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### Tracking Commands

Use the `track.sh` script to execute and track commands:

```bash
# Format
./scripts/track.sh [category] [command]

# Examples
./scripts/track.sh git "git push origin main"
./scripts/track.sh pnpm "pnpm install marked"
```

### Setting Up Command Aliases

Add the following aliases to your `.bashrc` or `.zshrc` file for easier command tracking:

```bash
# Replace with the actual path to your track.sh script
alias tgit='~/path/to/scripts/track.sh git'
alias tpnpm='~/path/to/scripts/track.sh pnpm'
alias tbuild='~/path/to/scripts/track.sh build'
alias tdeploy='~/path/to/scripts/track.sh deploy'
alias tdb='~/path/to/scripts/track.sh database'
alias tsys='~/path/to/scripts/track.sh system'
alias tother='~/path/to/scripts/track.sh other'
```

Then use them like:

```bash
tgit "git push origin main"
tpnpm "pnpm install marked"
```

## TypeScript Service

The `commandHistoryService.ts` provides methods for interacting with the command history system:

```typescript
// Import the service
import { CommandHistoryService } from '../services/commandHistoryService';

// Create an instance
const commandHistory = new CommandHistoryService();

// Record a command
await commandHistory.recordCommand(
  'git push origin main',
  'git',
  0,
  1500,
  'Pushed changes to main branch',
  ['deployment', 'git']
);

// Get command history
const history = await commandHistory.getCommandHistory({
  categoryFilter: 'git',
  successFilter: true,
  searchTerm: 'push',
  pageSize: 10,
  pageNumber: 1
});

// Get favorite commands
const favorites = await commandHistory.getFavoriteCommands();

// Get command suggestions
const suggestions = await commandHistory.getCommandSuggestions();

// Get most used commands
const mostUsed = await commandHistory.getMostUsedCommands('30 days', 10);

// Get command usage by category
const categoryUsage = await commandHistory.getCommandUsageByCategory('30 days');
```

## Analytics Functions

The system provides several analytics functions:

- `sanitize_command`: Sanitizes command text based on patterns
- `get_most_used_commands`: Gets the most used commands within a time period
- `get_command_usage_by_category`: Gets command usage statistics by category
- `get_command_history`: Gets command history with filtering and pagination
- `increment_favorite_command_usage`: Increments usage count for a favorite command

## Command Sanitization

The system sanitizes commands to remove sensitive information before storing them. Add patterns to the `command_patterns` table to define what should be sanitized:

```sql
INSERT INTO command_patterns (pattern, replacement, is_active, description)
VALUES 
  ('password=\w+', 'password=***', true, 'Hide passwords'),
  ('token=\w+', 'token=***', true, 'Hide tokens'),
  ('key=\w+', 'key=***', true, 'Hide keys');
```

## Security

The system uses Row Level Security (RLS) to ensure that users can only access their own command history and favorite commands. The following policies are applied:

- Users can only view their own command history
- Users can only manage their own favorite commands
- Command categories and patterns are accessible to all authenticated users 