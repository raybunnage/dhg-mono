# All Pipelines CLI

A master CLI for running health checks across all DHG pipeline services and reporting a consolidated status view.

## Features

- **Master Health Check**: Run health checks across all service pipelines in the system
- **Categorized Reporting**: Results are grouped and displayed by service category
- **Status Indicators**: Clear colored status indicators for each service
- **Flexible Filtering**: Include or exclude specific pipelines
- **Configurable Timeout**: Adjust timeout values for health check operations
- **Verbose Mode**: Get detailed output from health checks when needed

## Usage

```bash
# Show help information
./all-pipelines-cli.sh help

# Run health checks for all pipelines
./all-pipelines-cli.sh master-health-check

# Run health checks with verbose output
./all-pipelines-cli.sh master-health-check --verbose

# Run health checks for specific pipelines
./all-pipelines-cli.sh master-health-check --include google_sync,document

# Run health checks excluding specific pipelines
./all-pipelines-cli.sh master-health-check --exclude media_processing

# Set custom timeout (in milliseconds)
./all-pipelines-cli.sh master-health-check --timeout 60000
```

## Service Categories

The master health check organizes services into the following categories:

- **Content**: Document processing, media, and content-related services
- **Data Integration**: Services for integrating with external data sources
- **AI Services**: AI and prompt-related services
- **Infrastructure**: Core infrastructure services like Supabase
- **System**: System management services

## Required Infrastructure

Each underlying CLI pipeline should implement a `health-check` command to be compatible with the master health check. The health check command should:

1. Return exit code 0 on success
2. Return non-zero exit code on failure
3. Provide meaningful output about the health status

## Implementation Details

- Built with TypeScript and Commander.js
- Includes command tracking
- Parallelizes health checks for efficient execution
- Color-coded output for easy status interpretation