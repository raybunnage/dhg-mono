# Classify CLI Pipeline

The classify pipeline provides commands for managing subject classifications in the system. It allows creating, updating, and organizing classification hierarchies.

## Installation and Setup

No additional installation is required. The CLI uses the shared Supabase connection and other services already set up in the project.

### Database Setup

Before using the CLI, you'll need to create the `subject_classifications` table in your Supabase database. You can use the following SQL:

```sql
CREATE TABLE IF NOT EXISTS public.subject_classifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.subject_classifications(id),
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Optional: Create an index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_subject_classifications_name ON public.subject_classifications(name);

-- Optional: Create an index for faster hierarchical queries
CREATE INDEX IF NOT EXISTS idx_subject_classifications_parent_id ON public.subject_classifications(parent_id);
```

## Usage

Run the CLI from the project root:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh [command] [options]
```

## Available Commands

### List Classifications

List all subject classifications:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh list
```

Options:
- `-c, --category <category>`: Filter by category
- `-f, --format <format>`: Output format (table, json)
- `-o, --output-file <path>`: Path to write output to

### Get Classification

Get a specific classification by ID:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh get <id>
```

Options:
- `-f, --format <format>`: Output format (table, json)

### Create Classification

Create a new classification:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh create --name "Healthcare" --category "Medical"
```

Options:
- `-n, --name <name>`: Classification name (required)
- `-d, --description <desc>`: Classification description
- `-c, --category <category>`: Classification category
- `-p, --parent-id <id>`: Parent classification ID
- `--inactive`: Set as inactive (default is active)

### Update Classification

Update an existing classification:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh update <id> --name "New Name"
```

Options:
- `-n, --name <name>`: New classification name
- `-d, --description <desc>`: New classification description
- `-c, --category <category>`: New classification category
- `-p, --parent-id <id>`: New parent classification ID
- `--active <bool>`: Set active status (true/false)

### Delete Classification

Delete a classification:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh delete <id>
```

Options:
- `--force`: Force deletion without confirmation

### Hierarchical View

Get hierarchical view of classifications:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh hierarchy
```

Options:
- `-f, --format <format>`: Output format (tree, json)
- `-o, --output-file <path>`: Path to write output to

### Batch Create

Create multiple classifications from a JSON file:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh batch-create <file>
```

The JSON file should contain an array of classification objects:

```json
[
  {
    "name": "Medicine",
    "description": "Medical classifications",
    "category": "Healthcare"
  },
  {
    "name": "Surgery",
    "description": "Surgical procedures",
    "parent_id": "PARENT_UUID_HERE",
    "category": "Healthcare"
  }
]
```

Options:
- `--dry-run`: Show what would be created without actually creating records

### Health Check

Check the health of the classify service:

```bash
./scripts/cli-pipeline/classify/classify-cli.sh health-check
```

Options:
- `--verbose`: Show detailed output

## Examples

```bash
# List all classifications
./scripts/cli-pipeline/classify/classify-cli.sh list

# Create a new classification
./scripts/cli-pipeline/classify/classify-cli.sh create --name "Medicine" --category "Healthcare"

# Create a child classification
./scripts/cli-pipeline/classify/classify-cli.sh create --name "Surgery" --parent-id "12345678-1234-5678-1234-567812345678" --category "Healthcare"

# Update a classification
./scripts/cli-pipeline/classify/classify-cli.sh update 12345678-1234-5678-1234-567812345678 --name "General Medicine"

# Delete a classification with confirmation
./scripts/cli-pipeline/classify/classify-cli.sh delete 12345678-1234-5678-1234-567812345678

# Get hierarchical view as JSON
./scripts/cli-pipeline/classify/classify-cli.sh hierarchy -f json -o hierarchy.json

# Run health check
./scripts/cli-pipeline/classify/classify-cli.sh health-check --verbose
```