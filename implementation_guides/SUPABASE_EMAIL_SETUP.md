# Supabase Email Templates & SMTP Configuration Guide

This guide provides step-by-step instructions for configuring email templates and SMTP settings for production use in your Supabase project.

## 📧 Email Templates Created

The following email templates have been created in the `supabase/email-templates/` directory:

1. **confirm-signup.html** - Welcome email with account confirmation
2. **reset-password.html** - Password reset instructions
3. **magic-link.html** - Passwordless login link
4. **invite-user.html** - User invitation email
5. **change-email.html** - Email address change confirmation

Each template includes:
- Professional CloneAI branding
- Responsive design for mobile/desktop
- Alternative OTP codes for accessibility
- Security notices and best practices
- Clear call-to-action buttons

## 🔧 Manual Configuration Required

### Step 1: Configure Email Templates in Supabase Dashboard

Since email templates cannot be configured via API, you need to manually update them through the Supabase Dashboard:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: "AI clone" (qspwdnnbxjurlmgmztco)
3. Navigate to **Authentication** → **Email Templates**
4. Update each template by copying the HTML content from the files above

#### Template Configuration Details:

**Confirm Signup Template:**
```html
<!-- Copy content from supabase/email-templates/confirm-signup.html -->
<!-- Make sure to use: {{ .ConfirmationURL }} and {{ .Token }} variables -->
```

**Reset Password Template:**
```html
<!-- Copy content from supabase/email-templates/reset-password.html -->
<!-- Make sure to use: {{ .ConfirmationURL }} and {{ .Token }} variables -->
```

**Magic Link Template:**
```html
<!-- Copy content from supabase/email-templates/magic-link.html -->
<!-- Make sure to use: {{ .ConfirmationURL }} and {{ .Token }} variables -->
```

**Invite User Template:**
```html
<!-- Copy content from supabase/email-templates/invite-user.html -->
<!-- Make sure to use: {{ .ConfirmationURL }} and {{ .Token }} variables -->
```

**Change Email Template:**
```html
<!-- Copy content from supabase/email-templates/change-email.html -->
<!-- Make sure to use: {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}, and {{ .NewEmail }} variables -->
```

### Step 2: Configure Authentication Settings

1. **Enable Email Confirmation:**
   - Go to **Authentication** → **Providers** → **Email**
   - Enable **"Confirm email"** toggle
   - Enable **"Secure email change"** (recommended)

2. **Configure Site URL and Redirect URLs:**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL**: 
     - Development: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - Add **Redirect URLs**:
     - `http://localhost:3000/auth/confirm`
     - `http://localhost:3000/auth/reset-password`
     - `http://localhost:3000/dashboard`
     - `https://yourdomain.com/auth/confirm`
     - `https://yourdomain.com/auth/reset-password`
     - `https://yourdomain.com/dashboard`

## 🚀 Production SMTP Configuration

### Step 3: Choose an Email Service Provider

For production, you need a reliable SMTP provider. Here are the recommended options:

#### Option 1: Resend (Recommended)
- **Why**: Developer-friendly, good deliverability, simple pricing
- **Pricing**: 3,000 emails/month free, then $20/month for 50k emails
- **Setup**:
  1. Sign up at https://resend.com
  2. Verify your domain
  3. Get API key from dashboard

#### Option 2: AWS SES
- **Why**: Enterprise-grade, very cost-effective for high volume
- **Pricing**: $0.10 per 1,000 emails
- **Setup**:
  1. Set up AWS SES in your AWS console
  2. Verify domain and move out of sandbox
  3. Create SMTP credentials

#### Option 3: SendGrid
- **Why**: Reliable, good analytics, easy integration
- **Pricing**: 100 emails/day free, then $19.95/month for 40k emails
- **Setup**:
  1. Sign up at https://sendgrid.com
  2. Create API key
  3. Set up domain authentication

#### Option 4: Postmark
- **Why**: Focus on transactional emails, excellent deliverability
- **Pricing**: 100 emails/month free, then $15/month for 10k emails
- **Setup**:
  1. Sign up at https://postmarkapp.com
  2. Create server and get credentials
  3. Verify domain

### Step 4: Configure SMTP in Supabase Dashboard

1. Go to **Settings** → **Authentication** → **SMTP Settings**
2. Enable **"Enable custom SMTP"**
3. Configure based on your provider:

#### For Resend:
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: [Your Resend API Key]
Sender Email: noreply@yourdomain.com
Sender Name: CloneAI
```

#### For AWS SES:
```
SMTP Host: email-smtp.[region].amazonaws.com
SMTP Port: 587
SMTP User: [Your SMTP Username]
SMTP Password: [Your SMTP Password]
Sender Email: noreply@yourdomain.com
Sender Name: CloneAI
```

#### For SendGrid:
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@yourdomain.com
Sender Name: CloneAI
```

#### For Postmark:
```
SMTP Host: smtp.postmarkapp.com
SMTP Port: 587
SMTP User: [Your Server Token]
SMTP Password: [Your Server Token]
Sender Email: noreply@yourdomain.com
Sender Name: CloneAI
```

### Step 5: Domain Configuration for Production

#### DNS Records Setup:
For better deliverability, configure these DNS records:

1. **SPF Record** (TXT):
```
v=spf1 include:_spf.youremailprovider.com ~all
```

2. **DKIM Records** (TXT):
```
[Generated by your email provider]
```

3. **DMARC Record** (TXT):
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

#### Example for Resend:
```
TXT @ "v=spf1 include:_spf.resend.com ~all"
TXT resend._domainkey [DKIM key provided by Resend]
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

### Step 6: Testing Configuration

1. **Test Email Delivery:**
   - Try signing up with a new account
   - Test password reset flow
   - Test magic link login
   - Verify all emails are delivered

2. **Check Email Deliverability:**
   - Use tools like mail-tester.com
   - Monitor bounce rates in your email provider
   - Check spam folder delivery

3. **Monitor Email Metrics:**
   - Track delivery rates
   - Monitor bounce and complaint rates
   - Set up alerts for issues

## 📊 Production Monitoring & Best Practices

### Email Rate Limiting
- Start with Supabase's default 30 emails/hour limit
- Increase gradually based on your needs
- Monitor for abuse and implement CAPTCHA

### Security Considerations
1. **Enable CAPTCHA Protection**
   - Go to **Authentication** → **Settings**
   - Enable CAPTCHA for signup/signin

2. **Set Up Abuse Prevention**
   - Monitor signup patterns
   - Implement rate limiting on client side
   - Use email verification delays

3. **Email Security**
   - Use dedicated subdomain for auth emails (auth.yourdomain.com)
   - Never include promotional content in auth emails
   - Implement proper unsubscribe handling

### Backup Email Strategy
- Set up secondary SMTP provider
- Implement failover logic in your application
- Monitor primary provider uptime

## 🔍 Troubleshooting

### Common Issues:

1. **Emails Not Delivered:**
   - Check SMTP credentials
   - Verify domain DNS records
   - Check spam folders
   - Review email provider logs

2. **Template Variables Not Working:**
   - Ensure correct Supabase template variables: `{{ .ConfirmationURL }}`
   - Check for typos in variable names
   - Test with simple templates first

3. **High Bounce Rates:**
   - Verify email addresses at signup
   - Clean email lists regularly
   - Improve email content quality

4. **Deliverability Issues:**
   - Warm up your domain gradually
   - Maintain good sender reputation
   - Follow email best practices

## 📝 Environment Variables

Update your `.env.local` with production values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://qspwdnnbxjurlmgmztco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcHdkbm5ieGp1cmxtZ216dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMTUzNjMsImV4cCI6MjA2OTg5MTM2M30.9AIX20eYqhsE2jOIxpuBbmAwlGn3MXFXtHqgx0Ym3kI
SUPABASE_SERVICE_ROLE_KEY=[Get from Supabase Dashboard → Settings → API]

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Email Provider (Optional - for custom integrations)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=[Your email provider API key]
```

## ✅ Final Checklist

Before going to production:

- [ ] All email templates configured in Supabase Dashboard
- [ ] SMTP provider configured and tested
- [ ] DNS records set up (SPF, DKIM, DMARC)
- [ ] Email confirmation enabled
- [ ] Redirect URLs configured for production
- [ ] Rate limiting configured appropriately
- [ ] CAPTCHA protection enabled
- [ ] Monitoring and alerts set up
- [ ] Backup email provider configured
- [ ] Test all email flows end-to-end
- [ ] Environment variables updated for production

## 🆘 Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Review email provider delivery logs
3. Test with different email addresses
4. Contact Supabase support for authentication issues
5. Contact your email provider for delivery issues

## 🚀 Next Steps

After email configuration:
1. Test complete authentication flows
2. Set up user onboarding sequences
3. Implement email preferences
4. Add email analytics tracking
5. Create email notification system for clone interactions