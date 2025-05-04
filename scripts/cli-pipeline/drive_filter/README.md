# Drive Filter CLI

A command-line interface for managing filter profiles that can be applied to database queries. This allows you to create named filter profiles (e.g., "Presentations", "Transcripts", "All content") and apply filters consistently across the codebase.

## Installation

1. First, apply the database migrations to create the required tables:

```sh
./drive-filter-cli.sh apply-migrations
```

2. Verify the installation with a health check:

```sh
./drive-filter-cli.sh health-check
```

## Usage

### Creating and Managing Profiles

#### Create a new filter profile

```sh
./drive-filter-cli.sh create-profile -n "Presentations Only" -d "Filter for presentation files" --mime-types "application/vnd.google-apps.presentation" --mime-types "application/pdf"
```

Options:
- `-n, --name`: Profile name (required)
- `-d, --description`: Profile description
- `-a, --active`: Set as active profile
- `--mime-types`: Mime types to include (can specify multiple)
- `--document-types`: Document type IDs to include (can specify multiple)
- `--experts`: Expert IDs to include (can specify multiple)
- `--folders`: Folder IDs to include (can specify multiple)

#### Update an existing profile

```sh
./drive-filter-cli.sh update-profile -i "profile-uuid" -n "Updated Name" -a
```

Options:
- `-i, --id`: Profile ID (required)
- Other options are the same as create-profile

#### Delete a profile

```sh
./drive-filter-cli.sh delete-profile -i "profile-uuid" 
```

Options:
- `-i, --id`: Profile ID (required)
- `-f, --force`: Force deletion without confirmation (required if deleting active profile)

### Working with Profiles

#### List all profiles

```sh
./drive-filter-cli.sh list-profiles
```

Options:
- `--json`: Output as JSON instead of table format

#### Set active profile

```sh
./drive-filter-cli.sh set-active-profile -i "profile-uuid"
```

#### Get active profile

```sh
./drive-filter-cli.sh get-active-profile
```

Options:
- `--json`: Output as JSON instead of formatted text

### Managing Drive Exclusions

#### Add drive to profile exclude list

```sh
./drive-filter-cli.sh add-drive -i "profile-uuid" -d "drive-id"
```

#### Remove drive from profile exclude list

```sh
./drive-filter-cli.sh remove-drive -i "profile-uuid" -d "drive-id"
```

#### List drives in profile exclude list

```sh
./drive-filter-cli.sh list-drives -i "profile-uuid" --verbose
```

Options:
- `--verbose`: Show detailed information about each drive
- `--json`: Output as JSON

## Using the Filter Service in Code

The filter service is available as a singleton you can import in your code:

```typescript
import { filterService } from '../../../packages/shared/services/filter-service';

// Load the active profile
await filterService.loadActiveProfile();

// Apply filters to a query
const supabase = SupabaseClientService.getInstance().getClient();
let query = supabase.from('sources_google').select('*');

// Apply filter to the query
query = filterService.applyFilterToQuery(query);

// Execute the filtered query
const { data, error } = await query;
```

## Development

If adding functionality to the filter service, follow these guidelines:

1. Always use the singleton pattern as demonstrated in `filter-service.ts`
2. Add unit tests for any new functionality
3. Update this documentation as needed