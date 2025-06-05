# Gmail CLI Pipeline - Quick Start

## Essential Setup Steps

### 1. Install Python Dependencies
```bash
cd packages/python-gmail-service
pip install -r requirements.txt
```

### 2. Configure Gmail API Access

Choose ONE of these methods:

**Option A - OAuth (Personal Gmail)**
1. Download credentials.json from Google Cloud Console
2. Place in project root
3. Set in .env.development:
   ```
   GMAIL_CREDENTIALS_PATH=./credentials.json
   GMAIL_USER_EMAIL=your-email@gmail.com
   ```

**Option B - Service Account (Automated)**
1. Download service account JSON key
2. Save as .service-account.json in project root
3. Set in .env.development:
   ```
   GOOGLE_SERVICE_ACCOUNT_PATH=./.service-account.json
   GMAIL_USER_EMAIL=your-email@gmail.com
   ```

### 3. Test Connection
```bash
./scripts/cli-pipeline/gmail/test-gmail-api.sh
```

### 4. Add Important Addresses
```bash
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "important@example.com"
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses list
```

### 5. Run First Sync
```bash
# Test with 1 day of emails
./scripts/cli-pipeline/gmail/gmail-cli.sh sync-emails --days 1

# Check results
./scripts/cli-pipeline/gmail/gmail-cli.sh stats
```

## Required Environment Variables

Add to `.env.development`:

```bash
# Gmail API
GMAIL_CREDENTIALS_PATH=./credentials.json  # OR use service account below
GOOGLE_SERVICE_ACCOUNT_PATH=./.service-account.json
GMAIL_USER_EMAIL=your-email@gmail.com
GMAIL_MAX_RESULTS=500
GMAIL_SYNC_DAYS_BACK=365

# These should already exist from your setup:
SUPABASE_URL=your-url
SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

## Database Tables Created

The migration (20250604_create_email_tables.sql) created:
- `email_important_addresses` - Email whitelist
- `email_messages` - Raw email data
- `email_processed_contents` - Cleaned content
- `email_extracted_urls` - URLs from emails
- `email_extracted_concepts` - AI analysis
- `email_attachments` - Attachment metadata
- `email_attachment_pdfs` - PDF processing
- `email_sync_state` - Sync tracking

## Command Reference

```bash
# Test connection
./scripts/cli-pipeline/gmail/gmail-cli.sh test-connection

# Manage addresses
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "email@example.com"
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses list
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses remove "email@example.com"

# Sync emails
./scripts/cli-pipeline/gmail/gmail-cli.sh sync-emails --days 7
./scripts/cli-pipeline/gmail/gmail-cli.sh sync-emails --days 30 --importance 3

# View statistics
./scripts/cli-pipeline/gmail/gmail-cli.sh stats

# Process with AI (Phase 2 - requires ANTHROPIC_API_KEY)
./scripts/cli-pipeline/gmail/gmail-cli.sh process-emails --limit 10
```

## Troubleshooting

If sync fails:
1. Run `test-gmail-api.sh` to verify API access
2. Check `test-connection` to verify database
3. Ensure at least one important address is added
4. Check credentials file exists and has correct permissions
5. Verify Gmail API is enabled in Google Cloud Console

## What's Working Now

✅ Database tables created and ready  
✅ CLI pipeline structure in place  
✅ TypeScript command wrappers  
✅ Python Gmail service with modern API  
✅ Important address management  
✅ Connection testing tools  

## What Needs Implementation

🔲 OAuth authentication flow completion  
🔲 Actual email sync execution  
🔲 AI content processing integration  
🔲 URL and attachment extraction  
🔲 React app data connection  