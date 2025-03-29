# Google Service Account Authentication Guide

This guide explains how to set up and use Google Service Accounts for accessing Google APIs (like Drive, Sheets, etc.) in AI and automation projects. Service accounts provide long-lived authentication that doesn't require constant token refreshing, making them ideal for backend services, CLI tools, and AI data pipelines.

## Why Use Service Accounts?

Unlike OAuth user tokens that expire quickly (typically after 1 hour), service accounts:

- Provide stable, long-term API access without manual intervention
- Don't require user interaction or browser-based authentication flows
- Can be managed with fine-grained permissions
- Work reliably in headless environments like servers and CLI tools
- Are ideal for automated processes and batch jobs

## Setting Up a Google Service Account

### 1. Create a Project in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID for future reference

### 2. Enable Required APIs

1. Navigate to "APIs & Services" > "Library"
2. Search for and enable the APIs you need (e.g., Drive API, Sheets API)
3. Wait for the APIs to be enabled (usually immediate)

### 3. Create a Service Account

1. Navigate to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Fill in the details:
   - **Name**: Choose a descriptive name (e.g., "dhg-drive-sync")
   - **Description**: Describe the purpose (e.g., "Service account for Drive sync operations")
   - **ID**: Auto-generated or customize it
4. Click "Create and Continue"

### 4. Assign Permissions

1. Select appropriate roles for your service account:
   - For Google Drive access: "Drive API > Drive File Reader" or "Drive File Metadata Reader"
   - For broader access: "Drive API > Drive Admin"
   - Add other roles as needed
2. Click "Continue"

### 5. Grant User Access (Optional)

1. Add users who should have permission to manage this service account
2. Click "Done"

### 6. Create and Download Key File

1. Find your new service account in the list and click on it
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Click "Create" - this downloads a JSON key file
6. **IMPORTANT: Store this file securely!** It grants access to your Google services

## Using Service Accounts in Code

### Python Implementation

```python
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import io

def get_drive_service():
    # Path to your service account key file
    SERVICE_ACCOUNT_FILE = 'path/to/service-account-key.json'
    
    # Define the required scopes
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    
    # Authenticate using service account
    credentials = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, 
        scopes=SCOPES
    )
    
    # Build the Drive service
    service = build('drive', 'v3', credentials=credentials)
    return service

def list_files_in_folder(folder_id):
    """List files in a specific Google Drive folder"""
    service = get_drive_service()
    
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        pageSize=100,
        fields="nextPageToken, files(id, name, mimeType)"
    ).execute()
    
    return results.get('files', [])

def download_file(file_id):
    """Download a file from Google Drive"""
    service = get_drive_service()
    
    request = service.files().get_media(fileId=file_id)
    file_content = io.BytesIO()
    downloader = googleapiclient.http.MediaIoBaseDownload(file_content, request)
    
    done = False
    while not done:
        status, done = downloader.next_chunk()
        print(f"Download {int(status.progress() * 100)}%")
    
    return file_content
```

### Node.js/TypeScript Implementation

```typescript
import { google } from 'googleapis';
import * as fs from 'fs';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  // Other fields...
}

class GoogleDriveService {
  private driveClient;

  constructor(keyFilePath: string) {
    // Load the service account key file
    const credentials: ServiceAccountCredentials = JSON.parse(
      fs.readFileSync(keyFilePath, 'utf8')
    );

    // Create a JWT auth client
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    // Create and initialize the drive client
    this.driveClient = google.drive({ version: 'v3', auth: jwtClient });
  }

  async listFilesInFolder(folderId: string) {
    try {
      const response = await this.driveClient.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize: 100,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string) {
    try {
      const response = await this.driveClient.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });
      
      return response.data;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
}

// Usage
const driveService = new GoogleDriveService('/path/to/service-account-key.json');
driveService.listFilesInFolder('your-folder-id')
  .then(files => console.log('Files:', files))
  .catch(err => console.error('Error:', err));
```

## Advanced: Impersonating a User

By default, service accounts have their own identity and Drive storage, separate from any user. To access specific user's Drive files, you can set up domain-wide delegation:

1. In Google Workspace (formerly G Suite) admin console, go to Security > API Controls
2. In the "Domain-wide Delegation" section, click "Manage Domain-wide Delegation"
3. Add your service account's Client ID 
4. Add the necessary scopes (e.g., `https://www.googleapis.com/auth/drive.readonly`)

Then in your code:

```python
# Python example
credentials = Credentials.from_service_account_file(
    'service-account-key.json',
    scopes=['https://www.googleapis.com/auth/drive.readonly'],
    subject='user@yourdomain.com'  # The email of the user to impersonate
)
```

```typescript
// TypeScript example
const jwtClient = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/drive.readonly'],
  'user@yourdomain.com'  // The email of the user to impersonate
);
```

## Security Best Practices

1. **Never commit service account keys to version control**
   - Add key files to `.gitignore`
   - Consider using environment secrets management

2. **Store keys securely**
   - Use environment variables or secure vaults
   - Encrypt keys at rest

3. **Use the principle of least privilege**
   - Grant only the permissions needed for your application
   - Create different service accounts for different services

4. **Rotate keys periodically**
   - Create new keys and delete old ones periodically
   - Update your application to use the new keys

5. **Monitor usage**
   - Regularly review service account activity in Cloud Console
   - Set up alerts for suspicious activity

## Implementation in DHG-Mono

The DHG-Mono project already has a service account set up:

- **Email**: dhg-drive-helper@fabled-imagery-444902-k1.iam.gserviceaccount.com
- **Service Account ID**: 112125686334929012732
- **Status**: Enabled

To use this existing service account:

1. Use the existing service account key or download it if needed:
   - You already have an active key that effectively doesn't expire
   
   If you need to download the key again:
   - Go to [Google Cloud Console IAM & Admin](https://console.cloud.google.com/iam-admin/serviceaccounts) 
   - Select project "fabled-imagery-444902-k1"
   - Click on the service account "dhg-drive-helper"
   - Go to the "Keys" tab
   - If needed, create a new key with "Add Key" > "Create new key" > JSON

2. Save the key file as `.service-account.json` in the project root (don't forget to add to `.gitignore`)

3. Update environment variables to include:
   ```
   GOOGLE_SERVICE_ACCOUNT_PATH=/absolute/path/to/.service-account.json
   ```

4. Modify scripts to use service account authentication instead of tokens

## Troubleshooting

### Common Errors

1. **403 Forbidden**: Insufficient permissions
   - Check the roles assigned to your service account
   - Verify the file/folder permissions

2. **401 Unauthorized**: Authentication issues
   - Ensure your key file is valid and not corrupted
   - Check if the key has been revoked

3. **404 Not Found**: Invalid resources
   - Verify the file or folder IDs
   - Check if resources have been moved or deleted

### Debugging Tips

1. Enable more verbose logging:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. Verify service account permissions directly in Google Cloud Console

3. Test with minimal code to isolate issues

## Resources

- [Google Cloud Documentation: Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Python Google API Client Library](https://github.com/googleapis/google-api-python-client)
- [Node.js Google API Client Library](https://github.com/googleapis/google-api-nodejs-client)