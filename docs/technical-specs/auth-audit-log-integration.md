# Auth Audit Log Integration Guide

## Overview
This guide shows where and how to integrate `auth_audit_log` table into your authentication services for tracking user activity and analytics.

## Table Structure
The `auth_audit_log` table tracks:
- `user_id` - User who performed the action
- `event_type` - Type of authentication event
- `ip_address` - IP address of the request
- `user_agent` - Browser/client information
- `metadata` - Additional JSON data for the event
- `created_at` - Timestamp of the event

## Integration Points

### 1. auth-service.ts (Full Authentication Service)
**Status: Already Implemented ✅**

The service already has a `logAuthEvent()` method that writes to `auth_audit_log`:

```typescript
private async logAuthEvent(eventType: AuthEventType, metadata?: Record<string, any>): Promise<void>
```

**Current logging points:**
- `signIn()` → logs 'login' or 'login_failed'
- `signOut()` → logs 'logout'
- `refreshSession()` → logs 'session_refreshed'
- `updateUserProfile()` → logs 'profile_updated'
- `authenticateCLI()` → logs CLI authentication
- `createCLIToken()` → logs 'token_created'
- `revokeCLIToken()` → logs 'token_revoked'

### 2. light-auth-service.ts (Simplified Auth)
**Status: Not Implemented ❌**

**Add this private method:**
```typescript
private async logAuthEvent(eventType: string, metadata?: Record<string, any>): Promise<void> {
  try {
    const event = {
      user_id: metadata?.user_id || null,
      event_type: eventType,
      metadata,
      ip_address: null, // Would need to be passed from client
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
      created_at: new Date().toISOString()
    };
    
    await this.supabase
      .from('auth_audit_log')
      .insert(event);
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
}
```

**Add logging to these methods:**
- `registerUser()` → Add after successful registration:
  ```typescript
  await this.logAuthEvent('registration', { 
    user_id: allowedEmail.id,
    email: profile.email,
    method: 'light_auth'
  });
  ```

- `login()` → Add for both success and failure:
  ```typescript
  // On success:
  await this.logAuthEvent('login', { 
    user_id: allowedEmail.id,
    email: email,
    method: 'light_auth'
  });
  
  // On failure:
  await this.logAuthEvent('login_failed', { 
    email: email,
    reason: 'email_not_allowed'
  });
  ```

- `logout()` → Add before clearing session:
  ```typescript
  const user = this.getCurrentUser();
  if (user) {
    await this.logAuthEvent('logout', { user_id: user.id });
  }
  ```

- `removeFromWhitelist()` → Add after successful removal:
  ```typescript
  await this.logAuthEvent('access_revoked', { 
    email: email,
    revoked_by: currentUser?.id
  });
  ```

### 3. browser-auth-service.ts
**Status: Depends on Implementation**

If using as a wrapper for auth-service.ts → Already has logging ✅

If standalone, add similar logging to light-auth-service.ts in:
- `signIn()`
- `signUp()`
- `signOut()`
- `approveAccessRequest()`
- `denyAccessRequest()`

## Event Types to Track

### Standard Events
- `login` - Successful login
- `login_failed` - Failed login attempt
- `logout` - User logged out
- `registration` - New user registered
- `session_refreshed` - Session token refreshed
- `password_changed` - Password updated
- `profile_updated` - User profile modified

### Access Control Events
- `access_requested` - User requested access
- `access_approved` - Admin approved access
- `access_denied` - Admin denied access
- `access_revoked` - User access removed
- `email_whitelisted` - Email added to allowlist

### Token Events
- `token_created` - API token generated
- `token_revoked` - API token deleted
- `token_used` - API token used (for CLI)

## Metadata Examples

### Login Event
```json
{
  "email": "user@example.com",
  "method": "password|magic_link|oauth|cli",
  "provider": "google|github",
  "environment": "web|cli",
  "device_type": "desktop|mobile|tablet"
}
```

### Failed Login Event
```json
{
  "email": "user@example.com",
  "reason": "invalid_password|email_not_allowed|account_locked",
  "attempt_count": 3
}
```

### Access Control Event
```json
{
  "email": "user@example.com",
  "approved_by": "admin-user-id",
  "notes": "Approved for research team",
  "organization": "Example Corp"
}
```

## Analytics Queries

Once implemented, you can run analytics queries like:

```sql
-- Daily active users
SELECT DATE(created_at), COUNT(DISTINCT user_id)
FROM auth_audit_log
WHERE event_type = 'login'
GROUP BY DATE(created_at);

-- Failed login attempts by email
SELECT metadata->>'email', COUNT(*)
FROM auth_audit_log
WHERE event_type = 'login_failed'
GROUP BY metadata->>'email'
ORDER BY COUNT(*) DESC;

-- User activity timeline
SELECT user_id, event_type, created_at
FROM auth_audit_log
WHERE user_id = 'specific-user-id'
ORDER BY created_at DESC;
```

## Implementation Priority
1. **High Priority**: Add to light-auth-service.ts since it's missing
2. **Medium Priority**: Enhance metadata in existing auth-service.ts logs
3. **Low Priority**: Add client IP and device detection

## Notes
- IP address and user agent need to be passed from the client/request context
- Consider adding rate limiting based on failed login attempts
- Implement cleanup job for old audit logs (e.g., >90 days)
- Add indexes on `user_id`, `event_type`, and `created_at` for better query performance