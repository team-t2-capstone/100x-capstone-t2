# Email Templates Summary - CloneAI

## 📧 Templates Created

| Template | File | Purpose |
|----------|------|---------|
| **Confirm Signup** | `confirm-signup.html` | Welcome new users and confirm email |
| **Reset Password** | `reset-password.html` | Password reset instructions |
| **Magic Link** | `magic-link.html` | Passwordless authentication |
| **Invite User** | `invite-user.html` | Invite experts to join platform |
| **Change Email** | `change-email.html` | Confirm email address changes |

## 🎨 Template Features

### Design Elements:
- **CloneAI Branding**: Consistent purple theme (#7c3aed)
- **Responsive Design**: Mobile-friendly layouts
- **Professional Typography**: Clean, readable fonts
- **Clear CTAs**: Prominent action buttons
- **Security Notices**: Important security information

### Technical Features:
- **Supabase Variables**: Uses `{{ .ConfirmationURL }}`, `{{ .Token }}`, etc.
- **Alternative Methods**: OTP codes and manual links
- **Accessibility**: Clear hierarchy and readable text
- **Cross-platform**: Works across email clients

## 🔧 Implementation Steps

### 1. Manual Configuration Required
Since Supabase MCP doesn't support email template configuration, you need to:

1. **Copy Template HTML**: 
   - Navigate to each `.html` file in `supabase/email-templates/`
   - Copy the complete HTML content

2. **Paste in Supabase Dashboard**:
   - Go to Authentication → Email Templates
   - Select each template type
   - Paste the corresponding HTML

### 2. Required Dashboard Changes
- Authentication → Providers → Email → Enable "Confirm email"
- Authentication → URL Configuration → Set site URLs and redirects
- Settings → Authentication → SMTP Settings → Configure production SMTP

## 📋 Template Variable Reference

| Variable | Description | Used In |
|----------|-------------|---------|
| `{{ .ConfirmationURL }}` | Main action link | All templates |
| `{{ .Token }}` | 6-digit OTP code | All templates |
| `{{ .Email }}` | Current email address | Change email |
| `{{ .NewEmail }}` | New email address | Change email |
| `{{ .SiteURL }}` | Application site URL | Available for all |
| `{{ .RedirectTo }}` | Redirect destination | Available for all |

## 🚀 Production SMTP Providers

### Recommended Options:

1. **Resend** (Recommended for startups)
   - 3,000 emails/month free
   - Developer-friendly API
   - Good deliverability

2. **AWS SES** (Enterprise/High Volume)
   - $0.10 per 1,000 emails
   - Highly scalable
   - Requires domain verification

3. **SendGrid** (Balanced option)
   - 100 emails/day free
   - Good analytics
   - Reliable delivery

4. **Postmark** (Transactional focus)
   - 100 emails/month free
   - Excellent deliverability
   - Simple integration

## ⚡ Quick Setup Commands

### Environment Variables:
```bash
# Add to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://qspwdnnbxjurlmgmztco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### DNS Records (Example for Resend):
```dns
TXT @ "v=spf1 include:_spf.resend.com ~all"
TXT resend._domainkey [DKIM key from Resend]
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

## 🔒 Security Best Practices

1. **Enable CAPTCHA** for signup/signin
2. **Use dedicated subdomain** for auth emails
3. **Implement rate limiting** on email sends
4. **Monitor bounce rates** and deliverability
5. **Set up backup SMTP** provider

## 📊 Testing Checklist

- [ ] Signup confirmation email
- [ ] Password reset email  
- [ ] Magic link email
- [ ] User invitation email
- [ ] Email change confirmation
- [ ] All links work correctly
- [ ] OTP codes function
- [ ] Mobile display looks good
- [ ] Spam folder check
- [ ] Cross-client testing

## 🆘 Troubleshooting

### Common Issues:
- **Variables not rendering**: Check Supabase template syntax
- **Emails not delivered**: Verify SMTP configuration
- **Broken links**: Check redirect URL configuration
- **Spam delivery**: Improve DNS records and content

### Debug Steps:
1. Check Supabase logs
2. Test with different email providers
3. Verify DNS records
4. Review email provider logs
5. Test template rendering

---

**Next Steps**: Follow the detailed guide in `SUPABASE_EMAIL_SETUP.md` for complete configuration instructions.