# Auth Service Integration Guide

## Overview

The DHG monorepo provides a comprehensive authentication service that can be used across all applications. This guide demonstrates how to integrate the auth service into your apps using the test-audio app as a reference implementation.

## Architecture

### Core Components

1. **Auth Service** (`packages/shared/services/auth-service/`)
   - Singleton service providing unified authentication
   - Supports multiple auth methods (email/password, magic links, OAuth, API keys)
   - Handles session management and automatic refresh
   - Provides audit logging and permission checking

2. **Shared React Components** (`packages/shared/components/auth/`)
   - `AuthForm` - Flexible authentication form supporting signin/signup/magic-link modes
   - `AuthModal` - Modal wrapper for AuthForm
   - `UserMenu` - Dropdown menu for authenticated users
   - `ProtectedRoute` - Route protection component

3. **React Hooks** (`useAuth`)
   - Provides authentication state management
   - Offers methods like `signIn`, `signUp`, `signOut`, `sendMagicLink`
   - Includes helper hooks: `usePermission`, `useRoles`
   - Provides `withAuth` HOC for protecting components

## Quick Start

### 1. Install Dependencies

Add these to your app's `package.json`:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@supabase/supabase-js": "^2.31.0",
    "@tanstack/react-query": "^4.32.6",
    "lucide-react": "^0.503.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.2"
  }
}
```

### 2. Set Up Environment Variables

Create `.env.development`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Copy the useAuth Hook

Copy the `useAuth.tsx` hook from the test-audio app to your app's hooks directory. This hook provides the interface between your React app and the auth service.

### 4. Import Shared Components

```typescript
import { 
  AuthForm, 
  AuthModal, 
  UserMenu, 
  ProtectedRoute 
} from '@dhg/shared-components';
```

## Implementation Examples

### Basic Login Page

```tsx
import React, { useState } from 'react';
import { AuthForm, AuthFormData } from '@dhg/shared-components';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic-link'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signIn, signUp, sendMagicLink } = useAuth();

  const handleSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin' && data.password) {
        const result = await signIn(data.email, data.password);
        if (result.error) {
          setError(result.error.message);
        }
      }
      // Handle other modes...
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      mode={mode}
      onSubmit={handleSubmit}
      onModeChange={setMode}
      loading={loading}
      error={error}
    />
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute } from '@dhg/shared-components';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute 
            isAuthenticated={!!user} 
            isLoading={loading} 
            redirectTo="/login"
          >
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

### User Menu Integration

```tsx
import { UserMenu } from '@dhg/shared-components';
import { useAuth } from '../hooks/useAuth';

function Header() {
  const { user, signOut } = useAuth();

  const userInfo = {
    email: user?.email,
    name: user?.user_metadata?.full_name,
    avatar: user?.user_metadata?.avatar_url
  };

  return (
    <header>
      <UserMenu 
        user={userInfo} 
        onSignOut={signOut}
        onOpenSettings={() => navigate('/settings')}
      />
    </header>
  );
}
```

## Authentication Methods

### Email/Password

```typescript
const { signIn, signUp } = useAuth();

// Sign in
const result = await signIn('user@example.com', 'password');

// Sign up
const result = await signUp('user@example.com', 'password', {
  full_name: 'John Doe'
});
```

### Magic Links

```typescript
const { sendMagicLink } = useAuth();

const result = await sendMagicLink('user@example.com');
// User receives email with login link
```

### OAuth (Coming Soon)

The auth service supports OAuth providers (Google, GitHub, GitLab) but UI components for OAuth are not yet implemented.

## Permissions and Roles

### Check Permissions

```typescript
const { hasPermission, loading } = usePermission('admin:access');

if (hasPermission) {
  // Show admin content
}
```

### Check Roles

```typescript
const { roles, hasRole } = useRoles();

if (hasRole('editor')) {
  // Show editor features
}
```

## Testing

The test-audio app includes comprehensive tests for both the auth service and components:

- `src/test/auth-service.test.ts` - Unit tests for auth service functionality
- `src/test/auth-components.test.tsx` - Component tests for shared auth components

Run tests with:

```bash
cd apps/test-audio
pnpm test
```

## Customization

### Styling

All components use Tailwind CSS classes. You can override styles by:

1. Extending your Tailwind config
2. Adding custom CSS classes
3. Creating wrapper components with custom styling

### Custom Auth Forms

While the shared `AuthForm` component handles most use cases, you can create custom forms that use the `useAuth` hook directly:

```tsx
function CustomLoginForm() {
  const { signIn } = useAuth();
  
  // Implement your custom form UI
  // Call signIn() when submitting
}
```

## Backend Integration

The auth service works with the CLI pipeline authentication system. Backend scripts can authenticate using:

- Service accounts (environment variables)
- CLI tokens (stored securely)
- API keys

See the auth service documentation for backend usage.

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with real credentials
2. **HTTPS Only**: Always use HTTPS in production
3. **Session Management**: The auth service handles automatic session refresh
4. **Permission Checking**: Always verify permissions on both frontend and backend

## Troubleshooting

### Common Issues

1. **"No Supabase client found"**
   - Ensure environment variables are set correctly
   - Check that `.env.development` file exists

2. **"User not authenticated"**
   - Check if session has expired
   - Verify auth state is properly initialized

3. **Component styling issues**
   - Ensure Tailwind CSS is properly configured
   - Check that shared components path is included in Tailwind config

### Debug Mode

Enable debug logging in the auth service:

```typescript
// In your app initialization
if (import.meta.env.DEV) {
  window.localStorage.setItem('auth-debug', 'true');
}
```

## Next Steps

1. Review the test-audio app for a complete implementation example
2. Customize the components to match your app's design
3. Implement additional auth methods as needed (OAuth, 2FA)
4. Add analytics and monitoring for auth events

## Related Documentation

- [Auth Service API Reference](../code-documentation/auth-service-api.md)
- [CLI Authentication Guide](../cli-pipeline/auth-cli-commands.md)
- [Supabase Configuration](../deployment-environment/supabase-manager-guide.md)