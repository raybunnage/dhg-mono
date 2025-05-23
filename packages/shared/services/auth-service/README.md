# Authentication Service

A comprehensive authentication service for the DHG ecosystem that provides unified authentication for both CLI and web applications using Supabase Auth.

## Features

- **Unified Authentication**: Single service handles both CLI and web authentication
- **Multiple Auth Methods**: Email/password, magic links, OAuth, API keys
- **Session Management**: Automatic session refresh and validation
- **CLI Integration**: Secure token-based authentication for CLI tools
- **Service Accounts**: Support for automated scripts and CI/CD
- **Audit Trail**: Comprehensive logging of authentication events
- **Role-Based Access**: Permission and role management
- **Profile Management**: User profile storage and updates

## Installation

The authentication service is part of the shared services package:

```typescript
import { authService } from '../../../packages/shared/services/auth-service';
```

## Usage

### Web Application Authentication

#### Sign In
```typescript
const { session, user, error } = await authService.signIn(email, password);

if (error) {
  console.error('Login failed:', error.message);
} else {
  console.log('Logged in as:', user.email);
}
```

#### Sign Up
```typescript
const { session, user, error } = await authService.signUp(email, password, {
  data: {
    full_name: 'John Doe'
  }
});
```

#### Sign Out
```typescript
await authService.signOut();
```

#### Get Current User
```typescript
const user = await authService.getCurrentUser();
if (user) {
  console.log('Current user:', user.email);
}
```

#### React Hook Example
```typescript
function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get initial session
    authService.getCurrentUser().then(user => {
      setUser(user);
      setLoading(false);
    });
    
    // Listen for auth changes
    const subscription = authService.onAuthStateChange((user) => {
      setUser(user);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return { user, loading };
}
```

### CLI Authentication

#### Using API Key
```bash
# Set API key as environment variable
export DHG_CLI_API_KEY="your-api-key-here"

# Or pass directly to command
dhg-cli --api-key="your-api-key-here" command
```

#### In CLI Command
```typescript
// Authenticate before running command
const session = await authService.authenticateCLI();

if (!session) {
  console.error('Authentication required. Set DHG_CLI_API_KEY or run "dhg-cli auth login"');
  process.exit(1);
}

// Proceed with authenticated operations
console.log('Authenticated as:', session.user.email);
```

#### Service Account Authentication
```typescript
// For automated scripts
const session = await authService.authenticateServiceAccount();

if (!session) {
  console.error('Service account authentication failed');
  process.exit(1);
}
```

### Managing CLI Tokens

#### Create a New Token
```typescript
// Create a token that expires in 90 days
const token = await authService.createCLIToken('my-automation-token', 90);
console.log('Save this token securely:', token);
```

#### List Tokens
```typescript
const tokens = await authService.listCLITokens();
tokens.forEach(token => {
  console.log(`${token.name}: Last used ${token.last_used || 'never'}`);
});
```

#### Revoke a Token
```typescript
await authService.revokeCLIToken(tokenId);
```

### Magic Link Authentication

```typescript
// Send magic link
const { error } = await authService.sendMagicLink({
  email: 'user@example.com',
  redirectTo: 'https://app.example.com/dashboard'
});

if (!error) {
  console.log('Check your email for the login link');
}
```

### OAuth Authentication

```typescript
// Initiate OAuth flow
const { error } = await authService.signInWithOAuth({
  provider: 'google',
  redirectTo: 'https://app.example.com/auth/callback'
});
```

### Permission Checking

```typescript
// Check if user has permission
const canEdit = await authService.hasPermission('documents:edit');

if (!canEdit) {
  console.error('You do not have permission to edit documents');
  return;
}

// Get user roles
const roles = await authService.getUserRoles();
console.log('User roles:', roles);
```

### Profile Management

```typescript
// Update user profile
const updatedUser = await authService.updateUserProfile({
  full_name: 'Jane Doe',
  preferences: {
    theme: 'dark',
    notifications: true
  }
});
```

## CLI Usage

Use the authentication CLI to manage authentication:

```bash
# Login
./scripts/cli-pipeline/auth/auth-cli.sh login

# Show current user
./scripts/cli-pipeline/auth/auth-cli.sh whoami

# Create CLI token
./scripts/cli-pipeline/auth/auth-cli.sh token create "my-token"

# List tokens
./scripts/cli-pipeline/auth/auth-cli.sh token list

# Revoke token
./scripts/cli-pipeline/auth/auth-cli.sh token revoke <token-id>

# Show profile
./scripts/cli-pipeline/auth/auth-cli.sh profile

# Update profile
./scripts/cli-pipeline/auth/auth-cli.sh profile update

# Test service
./scripts/cli-pipeline/auth/auth-cli.sh test
```

## Database Schema

Run the migration to create required tables:

```sql
-- Located in: supabase/migrations/20250522000000_create_auth_service_tables.sql

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CLI authentication tokens
CREATE TABLE cli_auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authentication audit log
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

Add these to your `.env.development` file:

```bash
# Service Account (for automated processes)
SUPABASE_SERVICE_ACCOUNT_EMAIL=service@yourdomain.com
SUPABASE_SERVICE_ACCOUNT_KEY=your-service-account-password

# CLI Authentication
DHG_CLI_API_KEY=your-default-cli-api-key

# Session Configuration
AUTH_SESSION_DURATION=3600
AUTH_ENABLE_MAGIC_LINKS=true
```

## Security Considerations

1. **Token Storage**: CLI tokens are stored securely in `~/.dhg/auth.json` with 0600 permissions
2. **Token Hashing**: API keys are hashed using SHA-256 before storage
3. **Session Validation**: Sessions are validated on each request
4. **Audit Trail**: All authentication events are logged
5. **Rate Limiting**: Built-in handling for Supabase rate limits

## Integration with Existing Services

The authentication service integrates seamlessly with other services:

```typescript
// In a CLI command
import { authService } from '../../../packages/shared/services/auth-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function processDocuments() {
  // Authenticate first
  const session = await authService.authenticateCLI();
  if (!session) {
    throw new Error('Authentication required');
  }
  
  // Now use other services with authentication
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data: documents } = await supabase.from('documents').select('*');
  // Process documents...
}
```

## Files Created

### Shared Services
- `packages/shared/services/auth-service/auth-service.ts` - Main service implementation
- `packages/shared/services/auth-service/types.ts` - Type definitions
- `packages/shared/services/auth-service/index.ts` - Export index
- `packages/shared/services/auth-service/README.md` - This documentation

### CLI Pipeline
- `scripts/cli-pipeline/auth/auth-cli-commands.ts` - CLI command implementation
- `scripts/cli-pipeline/auth/auth-cli.sh` - Shell script wrapper
- `scripts/cli-pipeline/auth/package.json` - CLI package configuration

### React Hooks
- `apps/dhg-hub/src/hooks/useAuth.tsx` - Authentication hooks for DHG Hub
- `apps/dhg-audio/src/hooks/useAuth.tsx` - Authentication hooks for DHG Audio

### Database Migration
- `supabase/migrations/20250522000000_create_auth_service_tables.sql` - Database schema

## Next Steps

1. **Run the database migration** in your Supabase SQL editor
2. **Install dependencies** for the CLI pipeline: `cd scripts/cli-pipeline/auth && npm install`
3. **Test the CLI**: `./scripts/cli-pipeline/auth/auth-cli.sh test`
4. **Create your first user** and CLI token
5. **Update your React apps** to use the authentication hooks

## Troubleshooting

### Common Issues

1. **"No session found"**: Ensure you're authenticated before making requests
2. **"Token expired"**: CLI tokens expire after 90 days by default
3. **"Invalid credentials"**: Check email/password or API key
4. **"Rate limit exceeded"**: Wait before retrying authentication

### Debug Mode

Enable debug logging by setting environment variables.