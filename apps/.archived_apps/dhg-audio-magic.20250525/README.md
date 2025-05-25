# DHG Audio Magic

A demo audio application showcasing passwordless authentication with email allowlist and magic links.

## Features

### 🔐 Email Allowlist Authentication
- **Magic Link Login**: No passwords required - users receive a secure link via email
- **Email Allowlist**: Only pre-approved emails can access the app
- **Access Requests**: Non-approved users can request access with professional information
- **Progressive Profiling**: Collect user information gradually for better personalization

### 👤 User Features
- **Audio Dashboard**: Browse and play audio content
- **User Profile**: Complete professional profile with interests and expertise
- **Personalized Content**: Recommendations based on professional interests

### 🛡️ Admin Features
- **Access Management**: Review and approve/deny access requests
- **Email Allowlist**: Add or remove allowed emails
- **User Insights**: View professional interests and backgrounds of users

## Setup

### 1. Environment Variables
Copy `.env.example` to `.env` and add your Supabase credentials:

```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the App
```bash
npm run dev
```

### 4. Initial Admin Setup
1. Sign in with your email
2. Navigate to the dashboard
3. Click "Show admin setup option" in the developer tools section
4. Click "Make me admin" to grant yourself admin privileges
5. Remove the `make_me_admin` function from production!

## Authentication Flow

1. **Email Entry**: User enters their email address
2. **Allowlist Check**: System checks if email is on the allowed list
3. **Magic Link**: If allowed, user receives a magic link via email
4. **Access Request**: If not allowed, user can submit an access request with:
   - Name
   - Profession
   - Organization
   - Professional interests
   - Reason for access
5. **Admin Review**: Admins can approve or deny access requests
6. **Profile Completion**: New users are prompted to complete their profile

## Project Structure

```
src/
├── components/
│   ├── AdminPanel.tsx      # Admin interface for managing access
│   ├── AudioPlayer.tsx     # Audio playback component
│   ├── EmailAuth.tsx       # Email authentication component
│   ├── Layout.tsx          # App layout with navigation
│   ├── ProfilePrompt.tsx   # Profile completion modal
│   ├── ProtectedRoute.tsx  # Route protection wrapper
│   └── AdminRoute.tsx      # Admin-only route wrapper
├── hooks/
│   ├── useAuth.tsx         # Authentication hook
│   └── useIsAdmin.tsx      # Admin status hook
├── pages/
│   ├── LoginPage.tsx       # Login page with email auth
│   ├── DashboardPage.tsx   # Main audio dashboard
│   ├── ProfilePage.tsx     # User profile management
│   └── AdminPage.tsx       # Admin panel page
├── services/
│   └── auth-service.ts     # Authentication service
└── App.tsx                 # Main app component with routing
```

## Security Features

- **Email Verification**: Magic links verify email ownership
- **Row Level Security**: Database policies ensure users can only access their own data
- **Admin Roles**: Separate admin role for access management
- **No Passwords**: Eliminates password-related security risks

## Database Schema

The app uses the following main tables:
- `allowed_emails`: List of emails allowed to access the app
- `access_requests`: Pending access requests from non-allowed emails
- `user_profiles`: Extended user information including professional details
- `user_roles`: Simple role management (admin, moderator, user)

## Production Considerations

1. **Remove Developer Tools**: Remove the "Make me admin" functionality
2. **Email Configuration**: Ensure Supabase email settings are configured
3. **Domain Whitelisting**: Configure allowed redirect URLs in Supabase
4. **Rate Limiting**: Consider implementing rate limits for access requests
5. **Analytics**: Add tracking for user engagement and content preferences

## Testing the Auth Flow

1. **Allowed Email Flow**:
   - Add test emails to allowlist via admin panel
   - Sign in with allowed email
   - Receive and click magic link
   - Access granted immediately

2. **Access Request Flow**:
   - Sign in with non-allowed email
   - Fill out access request form
   - Admin reviews and approves
   - User added to allowlist automatically

3. **Profile Completion**:
   - New users prompted to complete profile
   - Can skip initially but prompted on next visit
   - Profile data used for personalization