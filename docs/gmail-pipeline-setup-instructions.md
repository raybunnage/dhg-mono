# Gmail Pipeline Setup Instructions

## Environment Setup Required

Before the Gmail pipeline can be fully operational, you need to configure the environment:

### 1. Create `.env.development` file
Copy `.env.example` to `.env.development` and fill in your actual credentials:

```bash
cp .env.example .env.development
```

Then edit `.env.development` with your actual Supabase credentials:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (for AI processing)

### 2. Register Gmail Pipeline Commands

Once credentials are configured, run these commands to register the Gmail pipeline:

```bash
# Populate the command registry
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry

# Sync command status
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh sync-command-status
```

### 3. Create Database Tables

Run the migration to create email-related tables:

```bash
# Create migration file
./scripts/cli-pipeline/database/database-cli.sh migration create gmail-tables

# Add the SQL from the technical spec to the migration file
# Then run the migration
./scripts/cli-pipeline/database/database-cli.sh migration run-staged
```

### 4. Set Up Google Authentication

For Gmail access, you need either:

#### Option A: OAuth 2.0 (Recommended for user-facing apps)
- Set up a Google Cloud Project
- Enable Gmail API
- Create OAuth 2.0 credentials
- Add to `.env.development`:
  ```
  GOOGLE_CLIENT_ID=your_client_id
  GOOGLE_CLIENT_SECRET=your_client_secret
  GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
  ```

#### Option B: Service Account (Recommended for automation)
- Create a service account in Google Cloud Console
- Download the JSON key file
- Save as `.service-account.json` in project root
- Grant necessary permissions in Google Workspace Admin

### 5. Install Dependencies

```bash
# Install Gmail pipeline dependencies
cd scripts/cli-pipeline/gmail
npm install

# Install Python dependencies (if not already done)
cd ../../../packages/python-gmail-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 6. Test the Pipeline

Once everything is configured:

```bash
# Test command help
./scripts/cli-pipeline/gmail/gmail-cli.sh help

# Test address management (doesn't require Gmail auth)
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses list

# Add a test address
./scripts/cli-pipeline/gmail/gmail-cli.sh manage-addresses add "test@example.com" --importance=2
```

## What Has Been Created

### CLI Pipeline Structure
```
scripts/cli-pipeline/gmail/
├── gmail-cli.sh          # Main CLI entry point (executable)
├── package.json          # Dependencies
├── README.md            # Comprehensive documentation
└── manage-addresses.ts   # TypeScript implementation example
```

### Commands Available
- `sync-emails` - Sync emails from Gmail
- `process-emails` - Process emails with AI
- `manage-addresses` - Manage important email addresses
- `analyze-concepts` - Extract concepts from emails
- `export-data` - Export email data
- `status` - Show pipeline status

### React App
The `dhg-research` app has been created at `apps/dhg-research/` with:
- Dark blue theme
- Gmail management UI
- Email list, sync, addresses, and analytics components
- Ready for database integration

## Next Steps

1. **Configure environment** - Add your credentials to `.env.development`
2. **Run command registration** - Register the Gmail pipeline in the database
3. **Create database tables** - Run the migration script
4. **Set up Google auth** - Configure OAuth or service account
5. **Implement remaining TypeScript commands** - Complete the CLI functionality
6. **Connect React app to database** - Replace mock data with real queries
7. **Import existing data** - Migrate from SQLite to PostgreSQL

## Troubleshooting

### "Unable to find Supabase credentials"
- Ensure `.env.development` exists with proper credentials
- Check that environment variables are being loaded
- Verify credentials are correct by testing with Supabase dashboard

### Gmail Authentication Issues
- For OAuth: Ensure redirect URI matches exactly
- For Service Account: Check permissions in Google Workspace
- Verify API is enabled in Google Cloud Console

### Command Not Found
- Ensure `gmail-cli.sh` is executable: `chmod +x gmail-cli.sh`
- Run from correct directory or use full path
- Check that dependencies are installed