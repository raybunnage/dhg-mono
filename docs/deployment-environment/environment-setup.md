# Environment Setup Guide

## Secret Management - IMPORTANT

This repository uses environment variables for all sensitive credentials, API keys, and configuration settings.

### Setting Up Your Environment

1. **Create a .env.development file** using the provided template:
   ```
   cp .env.development.example .env.development
   ```

2. **Fill in your credentials** in the .env.development file:
   - Supabase credentials (URL and API keys)
   - Google API credentials
   - Anthropic API credentials
   - Any other service-specific credentials

3. **Never commit sensitive files**:
   - .env
   - .env.development
   - .env.local
   - any file containing API keys

### Supabase Credentials

This project uses Supabase for database and authentication. You need to set up these variables:

```
# For server-side code and CLI scripts
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# For frontend Vite apps 
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Security Best Practices

1. **Rotate credentials** if you suspect they've been compromised
2. **Never hardcode credentials** in source code
3. **Use environment-specific variables** (.env.development for development, etc.)
4. **Check code before committing** to ensure no secrets are included

### Credential Rotation

If you need to rotate Supabase credentials:

1. Log into your Supabase dashboard
2. Go to Project Settings > API
3. Rotate the affected key
4. Update your .env.development file with the new key
5. Test your application to ensure it works with the new credentials

### For CI/CD Environments

For CI/CD pipelines, securely set environment variables through your platform's secure variables feature:
- Netlify: Environment variables in site settings
- GitHub Actions: Repository secrets
- Others: Consult your platform's documentation