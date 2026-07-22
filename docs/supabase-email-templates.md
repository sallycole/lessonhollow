# Supabase Email Templates

Curio uses custom-branded email templates for Supabase Auth transactional emails.

## Deployment

Templates are configured in the Supabase Dashboard:

1. Go to **Authentication → Email Templates**
2. Select the template type (e.g., "Confirm signup")
3. Paste the HTML from the corresponding section below
4. Save

## Design Principles

- **Table-based layout** with inline CSS for cross-client compatibility
- **Black/white/grey palette** with teal (#0D7C6B) primary accent — matches Curio design tokens
- **Fox emoji** (🦊) as logo — no image dependencies
- **Responsive** — single column, max-width 600px, fluid on mobile
- **Dark mode aware** — includes `color-scheme: light dark` meta tag
- Supabase template variables use Go syntax: `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, etc.

## Available Template Variables

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Full URL to confirm signup |
| `{{ .Token }}` | Raw OTP token |
| `{{ .TokenHash }}` | Hashed token for URL construction |
| `{{ .SiteURL }}` | Site base URL |
| `{{ .RedirectTo }}` | Redirect URL after action |
| `{{ .Email }}` | User's email address |

---

## Confirm Signup

Used when a new Guide creates an account.

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Confirm your Curio account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px; background-color: #1c1e2e;">
              <span style="font-size: 36px; line-height: 1;">&#x1F98A;</span>
              <br />
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Curio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #1c1e2e; line-height: 1.3;">
                Confirm your email
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Thanks for signing up for Curio. Tap the button below to confirm your email address and get started.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="background-color: #0D7C6B; border-radius: 6px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      Confirm email address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; color: #0D7C6B; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                If you didn't create a Curio account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                &#x1F98A; Curio — Build your curriculum. Track your progress.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Plain-text fallback

```
Confirm your Curio account

Thanks for signing up for Curio. Visit the link below to confirm your email address:

{{ .ConfirmationURL }}

If you didn't create a Curio account, you can safely ignore this email.

— Curio
```

---

## Password Recovery

Sent when a user requests a password reset (via REQ-003).

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Reset your Curio password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px; background-color: #1c1e2e;">
              <span style="font-size: 36px; line-height: 1;">&#x1F98A;</span>
              <br />
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Curio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #1c1e2e; line-height: 1.3;">
                Reset your password
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                We received a request to reset the password for your Curio account. Tap the button below to choose a new password.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="background-color: #0D7C6B; border-radius: 6px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; color: #0D7C6B; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                This link expires in 1 hour. If it has expired, you can <a href="{{ .SiteURL }}/reset-password" style="color: #0D7C6B; text-decoration: underline;">request a new one</a>.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                &#x1F98A; Curio — Build your curriculum. Track your progress.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Plain-text fallback

```
Reset your Curio password

We received a request to reset the password for your Curio account. Visit the link below to choose a new password:

{{ .ConfirmationURL }}

This link expires in 1 hour. If it has expired, request a new one at {{ .SiteURL }}/reset-password

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

— Curio
```

---

## Email Change Confirmation

Sent to the **new** email address when a user requests an email change. The old email remains active until the new one is confirmed.

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Confirm your new email for Curio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px; background-color: #1c1e2e;">
              <span style="font-size: 36px; line-height: 1;">&#x1F98A;</span>
              <br />
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Curio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #1c1e2e; line-height: 1.3;">
                Confirm your new email
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                You requested to change your Curio account email to this address. Tap the button below to confirm the change.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="background-color: #0D7C6B; border-radius: 6px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      Confirm new email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; color: #0D7C6B; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                If you didn't request an email change for your Curio account, you can safely ignore this email. Your email address will not be changed.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                &#x1F98A; Curio — Build your curriculum. Track your progress.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Plain-text fallback

```
Confirm your new email for Curio

You requested to change your Curio account email to this address. Visit the link below to confirm the change:

{{ .ConfirmationURL }}

If you didn't request an email change for your Curio account, you can safely ignore this email. Your email address will not be changed.

— Curio
```

---

## Invite User

Sent when a Guide invites a friend to try Curio (referral / "recommend to a friend" flow). The recipient may not know what Curio is, so the email includes a brief product description alongside the invite link.

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>You've been invited to Curio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px; background-color: #1c1e2e;">
              <span style="font-size: 36px; line-height: 1;">&#x1F98A;</span>
              <br />
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Curio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #1c1e2e; line-height: 1.3;">
                You've been invited to Curio
              </h1>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Someone thinks you'd love Curio — a personal curriculum tracker for self-directed learners. Build custom curricula, track daily progress, and guide your learners with a structured, flexible system.
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Tap the button below to create your free account and get started.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="background-color: #0D7C6B; border-radius: 6px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; color: #0D7C6B; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                This invitation link expires in 24 hours. If it has expired, ask the person who invited you to send a new one.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                If you weren't expecting this invitation, you can safely ignore this email. No account will be created.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                &#x1F98A; Curio — Build your curriculum. Track your progress.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Plain-text fallback

```
You've been invited to Curio

Someone thinks you'd love Curio — a personal curriculum tracker for self-directed learners. Build custom curricula, track daily progress, and guide your learners with a structured, flexible system.

Accept the invitation and create your free account:

{{ .ConfirmationURL }}

This invitation link expires in 24 hours. If it has expired, ask the person who invited you to send a new one.

If you weren't expecting this invitation, you can safely ignore this email. No account will be created.

— Curio
```
