# Google Drive Integration Guide

## Access Token Management

Google access tokens typically expire after one hour. Here's how to get a new token:

### Quick Token Refresh Method

1. Visit [Google OAuth Playground](https://developers.google.com/oauthplayground/)

2. Select required scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`

3. Click "Authorize APIs"

4. Click "Exchange authorization code for tokens"

5. Copy the new access token

6. Update your `.env.development`:
   ```env
   VITE_GOOGLE_ACCESS_TOKEN=your_new_access_token
   ```

### Important Notes

- Tokens expire after 1 hour
- Always include both scopes:
  - `drive.readonly` - Required for reading file contents
  - `drive.metadata.readonly` - Required for listing files and folders
- Keep your refresh token safe - it doesn't expire
- Never commit tokens to version control

### Troubleshooting

Common errors:
- 403 Error: Usually means token expired or missing required scopes
- 401 Error: Invalid or expired token
- "Failed to load file content": Check if token has `drive.readonly` scope

### Security Best Practices

1. Store tokens in environment variables
2. Never expose tokens in client-side code
3. Rotate refresh tokens periodically
4. Use minimal required scopes
5. Keep OAuth Playground credentials secure

### Environment Setup

Example `.env.development`:
```env
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_CLIENT_SECRET=your_client_secret
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_GOOGLE_ACCESS_TOKEN=your_access_token
VITE_GOOGLE_REFRESH_TOKEN=your_refresh_token
VITE_GOOGLE_DRIVE_FOLDER_ID=your_folder_id
```

## Token Refresh Process

When Google Drive tokens expire:

1. Visit http://localhost:5173/auth/google
2. Sign in with Google
3. Copy new tokens from callback URL
4. Update .env.development with new tokens

Note: Access tokens typically expire after 1 hour 