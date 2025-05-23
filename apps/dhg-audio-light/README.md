# DHG Audio Light

A lightweight authentication system for DHG Audio that doesn't require email verification.

## Features

- **No Email Verification**: Users can access the app immediately without checking their email
- **Simple Whitelist**: Check if email is on approved list
- **Auto-Registration**: New users fill out a profile and are automatically added to the whitelist
- **Admin Panel**: View and manage allowed emails
- **No Magic Links**: No email sending infrastructure required

## How It Works

1. **Existing Users**: Enter email → If on whitelist → Instant access
2. **New Users**: Enter email → Fill profile form → Auto-added to whitelist → Instant access
3. **Admin**: Can view all allowed emails and remove access if needed

## Database Tables Used

- `allowed_emails` - Stores the whitelist of approved email addresses
- Uses existing `is_email_allowed()` function from the email allowlist migration

## Security Considerations

- Anyone can register by filling out the profile form
- No email ownership verification (someone could use another person's email)
- Suitable for low-security applications where the main goal is collecting user information
- Admin can review and remove suspicious accounts later

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type check
npm run type-check

# Build for production
npm run build
```

## Environment Variables

Uses the same `.env.development` file as other apps in the monorepo:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Shared Service

This app uses the `light-auth-service` from `packages/shared/services/light-auth-service/` which provides:
- Email whitelist checking
- User registration (auto-approval)
- Mock session management
- Admin functions for managing allowed emails