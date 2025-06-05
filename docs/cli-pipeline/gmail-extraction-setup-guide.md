# Gmail Extraction Setup Guide

This guide covers the essential setup steps to get the Gmail extraction pipeline working in its starting phases.

## Prerequisites

### 1. Python Dependencies

Install the required Python packages in the `packages/python-gmail-service` directory:

```bash
cd packages/python-gmail-service
pip install -r requirements.txt
```

Required packages:
```
google-auth>=2.16.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.1.0
google-api-python-client>=2.88.0
asyncpg>=0.27.0
python-dotenv>=1.0.0
aiohttp>=3.8.0
```

### 2. Gmail API Setup

You need to enable Gmail API access using one of these methods:

#### Option A: OAuth 2.0 (Recommended for personal use)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as application type
   - Download the credentials JSON file
   - Save as `credentials.json` in the project root

#### Option B: Service Account (For automated/server use)
1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service account"
3. Fill in service account details
4. Grant "Gmail API" access
5. Download the JSON key file
6. Save as `.service-account.json` in the project root
7. **Important**: Grant domain-wide delegation if accessing other users' emails

### 3. Environment Variables

Add these to your `.env.development` file:

```bash
# Gmail API Configuration
GMAIL_CREDENTIALS_PATH=./credentials.json  # For OAuth
# OR
GOOGLE_SERVICE_ACCOUNT_PATH=./.service-account.json  # For Service Account

# Email sync settings
GMAIL_USER_EMAIL=your-email@gmail.com
GMAIL_MAX_RESULTS=500
GMAIL_SYNC_DAYS_BACK=365  # How far back to sync on first run

# Supabase (should already exist from your setup)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Tables Verification

The following tables should already exist from the migration:
- `email_important_addresses` - Whitelist of important email addresses
- `email_messages` - Main email storage
- `email_processed_contents` - Processed/cleaned email content
- `email_extracted_urls` - URLs found in emails
- `email_extracted_concepts` - AI-extracted concepts
- `email_attachments` - Email attachment metadata
- `email_attachment_pdfs` - PDF attachment processing
- `email_sync_state` - Sync tracking

### 5. Initial Data Setup

Before running the sync, you need to populate important email addresses:

```bash
# Add important email addresses to track
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "important@example.com"
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "vip@company.com"

# List current addresses
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses list
```

## Testing the Setup

### 1. Test Gmail API Connection

Create a test script to verify API access:

```bash
cd packages/python-gmail-service
python -c "
from src.gmail_service import GmailService
import asyncio

async def test():
    service = GmailService()
    await service.initialize()
    print('Gmail API initialized successfully!')
    
asyncio.run(test())
"
```

### 2. Test Database Connection

```bash
# This should show the email tables
./scripts/cli-pipeline/gmail/gmail-cli.sh test-connection
```

### 3. Run Initial Sync

Start with a small test batch:

```bash
# Sync last 7 days as a test
GMAIL_SYNC_DAYS_BACK=7 ./scripts/cli-pipeline/gmail/gmail-cli.sh sync-emails

# Check results
./scripts/cli-pipeline/gmail/gmail-cli.sh stats
```

## Troubleshooting

### Common Issues

1. **"Insufficient Permission" error**
   - Ensure Gmail API is enabled in Google Cloud Console
   - For service accounts, ensure domain-wide delegation is configured
   - Check that the correct scopes are requested (needs 'https://www.googleapis.com/auth/gmail.readonly')

2. **"No module named 'google'" error**
   - Install google-api-python-client: `pip install google-api-python-client`
   - Make sure you're in the virtual environment if using one

3. **Database connection errors**
   - Verify SUPABASE_URL and keys in .env.development
   - Ensure the email tables exist (check migration was applied)
   - Test with: `psql $DATABASE_URL -c "\dt email_*"`

4. **No emails being synced**
   - Check that important email addresses are configured
   - Verify GMAIL_USER_EMAIL matches your actual Gmail address
   - Try with a more specific query: `--query "from:specific@email.com"`

### Authentication Flow (First Run)

On first run with OAuth, you'll see:
1. Browser opens to Google sign-in
2. Select your Google account
3. Grant permissions to access Gmail
4. Browser shows "authentication successful"
5. Token saved locally for future use

## Next Steps

Once basic sync is working:

1. **Enable AI Processing** (Phase 2)
   - Add ANTHROPIC_API_KEY to .env.development
   - Run: `./scripts/cli-pipeline/gmail/gmail-cli.sh process-emails --with-ai`

2. **Extract URLs and Attachments** (Phase 3)
   - URLs are extracted automatically during sync
   - For PDF processing, install: `pip install pypdf2 pdfplumber`

3. **Connect React App** (Phase 4)
   - The dhg-research app will show synced emails
   - Update the app to use real Supabase queries instead of mock data

## Minimal Working Example

Here's the absolute minimum to get emails syncing:

```bash
# 1. Set environment variables (add to .env.development)
GMAIL_USER_EMAIL=your-email@gmail.com
GMAIL_CREDENTIALS_PATH=./credentials.json

# 2. Add at least one important address
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "test@example.com"

# 3. Run sync
./scripts/cli-pipeline/gmail/gmail-cli.sh sync-emails --days 1

# 4. Check if it worked
psql $DATABASE_URL -c "SELECT COUNT(*) FROM email_messages"
```

This should be enough to verify the Gmail extraction pipeline is working properly in its starting phase.