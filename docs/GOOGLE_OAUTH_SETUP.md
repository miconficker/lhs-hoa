# Google OAuth Setup Guide

This document describes how to set up Google OAuth for the Laguna Hills HOA system.

## Overview

Google OAuth allows residents to sign in with their Google account instead of a password. The system uses a **whitelist** approach - admins must pre-approve emails before users can sign in.

## How It Works

1. Admin adds an email to the whitelist via `/admin/whitelist`
2. Resident visits the login page and clicks "Sign in with Google"
3. Google handles authentication (password, 2FA, etc.)
4. Your app receives the user's email from Google
5. The app checks if the email is in the pre-approved whitelist
6. If approved → create session and log them in
7. If not approved → show "Contact HOA admin" message

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen (if prompted):
   - Choose "External" user type
   - Add app name: "Laguna Hills HOA"
   - Add your email as developer contact
   - Skip additional scopes for now
6. Create the OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: "Laguna Hills HOA"
   - Authorized redirect URIs:
     - Production: `https://your-domain.com/api/auth/google/callback`
     - Local dev: `http://localhost:5173/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### Local Development

Create `.dev.vars` file in the project root:

```bash
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
```

### Production

Set secrets via Cloudflare Pages:

```bash
# Set JWT secret
npx wrangler pages secret put JWT_SECRET --project-name=laguna-hills-hoa

# Set Google OAuth credentials
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=laguna-hills-hoa
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=laguna-hills-hoa
```

Update `wrangler.jsonc` with your production redirect URI:

```json
{
  "vars": {
    "GOOGLE_REDIRECT_URI": "https://your-domain.com/api/auth/google/callback"
  }
}
```

## Step 3: Run Database Migrations

```bash
# Local development
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0009_sso_password_optional.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0010_pre_approved_emails.sql --local

# Production
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0009_sso_password_optional.sql
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0010_pre_approved_emails.sql
```

## Step 4: Add Users to Whitelist

1. Log in as an admin
2. Navigate to **Email Whitelist** in the admin sidebar
3. Click "Add Email"
4. Enter the resident's email and role
5. Click "Add to Whitelist"

## Testing

1. Start the development server: `npm run dev:all`
2. Visit `/login`
3. Click "Sign in with Google"
4. Complete the Google sign-in flow
5. If your email is whitelisted, you should be logged in

## Security Considerations

- **No passwords stored** - Google handles all authentication
- **Whitelist required** - only pre-approved emails can sign in
- **JWT expires in 7 days** - users must re-authenticate periodically
- **HTTPS required** - OAuth requires HTTPS in production

## Troubleshooting

### Error: "redirect_uri_mismatch"

Make sure the redirect URI in Google Console matches exactly:
- Include the protocol (http:// or https://)
- Include the port for local development
- No trailing slashes

### Error: "Email not found in approved list"

The user's email is not in the `pre_approved_emails` table. An admin must add it via the whitelist management page.

### Error: "invalid_client"

Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly in your environment variables/secrets.

## Migration from Password-Based Auth

The migration allows `password_hash` to be NULL, so existing password users can continue logging in. To migrate users to SSO:

1. Add their email to the whitelist
2. Ask them to use "Sign in with Google" next time
3. Their old password will still work (no data loss)

## Future Enhancements

- Add Microsoft OAuth support
- Add Facebook OAuth support
- Add magic link login for users without SSO accounts
- Email invitations instead of manual whitelisting
