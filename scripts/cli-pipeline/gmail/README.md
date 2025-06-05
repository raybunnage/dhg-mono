# Gmail CLI Pipeline

This pipeline provides command-line tools for synchronizing, processing, and analyzing Gmail emails.

## Overview

The Gmail pipeline integrates with Gmail to:
- Sync emails from specified accounts
- Process email content with AI
- Extract concepts and insights
- Manage important email addresses
- Export data for analysis

## Prerequisites

1. **Google OAuth Setup** or **Service Account**
2. **Environment Variables** (see Configuration section)
3. **Python 3.8+** for Gmail API interaction
4. **Node.js 16+** for CLI commands

## Installation

```bash
# Install dependencies
cd scripts/cli-pipeline/gmail
npm install

# Set up Python environment (if needed)
cd ../../../packages/python-gmail-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuration

Create a `.env` file in the project root with:

```env
# Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Or use service account
GOOGLE_SERVICE_ACCOUNT_PATH=./.service-account.json

# Gmail settings
GMAIL_ACCOUNT=your_email@gmail.com
GMAIL_MAX_RESULTS=100
GMAIL_IMPORTANCE_THRESHOLD=1

# Processing settings
GMAIL_AI_PROCESSING_ENABLED=true
GMAIL_PROCESS_BATCH_SIZE=50
```

## Usage

### Basic Commands

```bash
# Show help
./gmail-cli.sh help

# Check pipeline status
./gmail-cli.sh status

# Sync emails from the last 7 days
./gmail-cli.sh sync-emails --days=7

# Process unprocessed emails
./gmail-cli.sh process-emails --limit=50

# Manage important addresses
./gmail-cli.sh manage-addresses add "researcher@example.com" --importance=2
./gmail-cli.sh manage-addresses list
./gmail-cli.sh manage-addresses remove "old@example.com"

# Analyze email concepts
./gmail-cli.sh analyze-concepts --from="2024-01-01"

# Export data
./gmail-cli.sh export-data --format=csv --output=./exports/
```

### Advanced Usage

#### Filtering by Importance
```bash
# Only sync emails from importance level 2+ addresses
./gmail-cli.sh sync-emails --days=30 --importance=2
```

#### Batch Processing
```bash
# Process emails in smaller batches
./gmail-cli.sh process-emails --limit=25 --batch-size=5
```

#### Custom Date Ranges
```bash
# Sync emails from a specific date range
./gmail-cli.sh sync-emails --from="2024-01-01" --to="2024-01-31"
```

## Database Schema

The pipeline uses the following main tables:

- `email_messages` - Core email metadata
- `email_processed_contents` - AI-analyzed content
- `email_extracted_concepts` - Extracted concepts and insights
- `email_important_addresses` - Important email address tracking
- `email_attachments` - Email attachment information
- `email_extracted_urls` - URLs found in emails

## Command Details

### sync-emails
Synchronizes emails from Gmail to the local database.

Options:
- `--days=N` - Number of days to sync (default: 7)
- `--from=DATE` - Start date (YYYY-MM-DD)
- `--to=DATE` - End date (YYYY-MM-DD)
- `--importance=N` - Minimum importance level (1-3)

### process-emails
Processes synchronized emails with AI to extract insights.

Options:
- `--limit=N` - Maximum emails to process (default: 50)
- `--batch-size=N` - Process in batches of N
- `--reprocess` - Reprocess already processed emails

### manage-addresses
Manages the list of important email addresses.

Subcommands:
- `add EMAIL [--importance=N]` - Add an email address
- `list` - List all important addresses
- `remove EMAIL` - Remove an email address
- `update EMAIL --importance=N` - Update importance level

### analyze-concepts
Analyzes processed emails to extract concepts and patterns.

Options:
- `--from=DATE` - Analyze from this date
- `--categories=LIST` - Filter by concept categories

### export-data
Exports email data for external analysis.

Options:
- `--format=FORMAT` - Export format (csv, json, xlsx)
- `--output=PATH` - Output directory
- `--include=LIST` - Data to include (emails,contents,concepts,urls)

## Development

### Adding New Commands

1. Create a new TypeScript file in this directory
2. Add the command to `gmail-cli.sh`
3. Update this README

### Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Troubleshooting

### Authentication Issues
- Ensure OAuth credentials or service account are properly configured
- Check token expiration and refresh if needed

### Sync Issues
- Verify network connectivity
- Check Gmail API quotas
- Review error logs in `logs/gmail-sync.log`

### Processing Issues
- Ensure Claude API key is configured
- Check for rate limiting
- Review processing logs

## Security Notes

- Never commit credentials to git
- Use environment variables for sensitive data
- Implement proper access controls for email data
- Follow data privacy regulations for email content

## Future Enhancements

- Real-time email monitoring
- Advanced filtering rules
- Email thread analysis
- Integration with other communication platforms
- Machine learning for email categorization