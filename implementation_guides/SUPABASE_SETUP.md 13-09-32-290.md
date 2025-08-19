# Supabase Authentication Setup Guide

This guide provides step-by-step instructions for configuring Supabase authentication with email confirmation and user profiles.

## 1. Database Setup

### Run the Migration

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Run the migration file: supabase/migrations/001_create_profiles_table.sql
```

This will create:
- `profiles` table with user data
- Row Level Security (RLS) policies
- Automatic profile creation trigger
- Email confirmation handling

## 2. Authentication Configuration

### Enable Email Confirmation

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Enable **"Confirm email"** toggle
4. Set **"Secure email change"** to enabled (recommended)

### Configure Site URL and Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/dashboard`
   - `https://yourdomain.com/auth/confirm` (for production)
   - `https://yourdomain.com/dashboard` (for production)

### Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. For **Confirm Signup** template, update the confirmation link:

```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your account:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm your email</a></p>
```

3. For **Magic Link** template (if using passwordless):

```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Log In</a></p>
```

## 3. SMTP Configuration (Production)

For production, configure custom SMTP:

1. Go to **Settings** → **Authentication** → **SMTP Settings**
2. Configure your email provider (SendGrid, Resend, etc.)
3. Set sender name and email address

## 4. Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 5. Testing the Setup

### Test Signup Flow

1. Start your development server: `npm run dev`
2. Go to `/auth/signup`
3. Create a new account
4. Check email for confirmation link
5. Click confirmation link
6. Verify redirect to dashboard

### Test Profile Creation

1. After signup, check Supabase dashboard
2. Go to **Table Editor** → **profiles**
3. Verify new profile was created automatically
4. Confirm `email_confirmed` is `true` after email confirmation

## 6. Security Considerations

### Row Level Security (RLS)

The profiles table has RLS enabled with these policies:
- Public profiles are viewable by everyone
- Users can only insert/update their own profile
- Admin access requires additional policies (if needed)

### Additional Security

1. Enable **"Enable Custom Access Token Hooks"** if needed
2. Configure **"JWT Settings"** if using custom claims
3. Set up **"Auth Hooks"** for additional validation

## 7. Troubleshooting

### Email Not Sent

1. Check SMTP configuration
2. Verify email templates are correctly formatted
3. Check spam/junk folders
4. Ensure redirect URLs are whitelisted

### Profile Not Created

1. Check if migration ran successfully
2. Verify trigger is active in Supabase
3. Check function execution in Supabase logs

### Confirmation Link Issues

1. Verify redirect URLs are configured
2. Check token expiration settings
3. Ensure email templates use correct variables

### Common Errors

- **"Invalid redirect URL"**: Add URL to redirect URLs list
- **"Email not confirmed"**: Check email confirmation settings
- **"Profile creation failed"**: Verify database trigger is active

## 8. Production Deployment

Before deploying:

1. Update Site URL to production domain
2. Add production redirect URLs
3. Configure production SMTP
4. Test email delivery
5. Enable rate limiting if needed
6. Set up monitoring and alerts

## Support

For additional help:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Email Templates Guide](https://supabase.com/docs/guides/auth/auth-email-templates)