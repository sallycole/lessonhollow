/**
 * Notification helpers — sends feedback emails via AWS SES.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

function getSESClient(): SESClient | null {
  const region = process.env.AWS_SES_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) return null
  return new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const TYPE_COLORS: Record<string, string> = {
  Bug: '#dc2626',
  Feature: '#0d9488',
  'Use Case': '#7c3aed',
  General: '#6b7280',
}

export function buildFeedbackEmailHtml(params: {
  feedbackType: string
  title: string
  details?: string
  userEmail?: string
  userId: string
  feedbackId: string
}): string {
  const badgeColor = TYPE_COLORS[params.feedbackType] ?? '#6b7280'
  const submitter = params.userEmail
    ? escapeHtml(params.userEmail)
    : `User ${escapeHtml(params.userId.slice(0, 8))}…`
  const timestamp = new Date().toISOString()

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:20px 24px;">
    <span style="font-size:20px;color:#ffffff;font-weight:700;">&#129418; Lesson Hollow Feedback</span>
  </td></tr>
  <tr><td style="padding:24px;">
    <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td style="background:${badgeColor};color:#ffffff;padding:4px 12px;border-radius:4px;font-size:13px;font-weight:600;">
        ${escapeHtml(params.feedbackType)}
      </td></tr>
    </table>
    <h2 style="margin:0 0 12px;font-size:18px;color:#1a1a2e;">${escapeHtml(params.title)}</h2>
    ${params.details ? `<p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.details)}</p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <table cellpadding="0" cellspacing="0" style="font-size:13px;color:#6b7280;">
      <tr><td style="padding:2px 8px 2px 0;font-weight:600;">From:</td><td>${submitter}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;font-weight:600;">ID:</td><td>${escapeHtml(params.feedbackId)}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;font-weight:600;">Time:</td><td>${timestamp}</td></tr>
    </table>
    ${params.userEmail ? `<p style="margin:16px 0 0;font-size:13px;"><a href="mailto:${escapeHtml(params.userEmail)}?subject=Re: ${encodeURIComponent(params.title)}" style="color:#0d7c6b;">Reply to submitter</a></p>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildFeedbackEmailText(params: {
  feedbackType: string
  title: string
  details?: string
  userEmail?: string
  userId: string
  feedbackId: string
}): string {
  const submitter = params.userEmail ?? `User ${params.userId.slice(0, 8)}…`
  const timestamp = new Date().toISOString()
  const lines = [
    `[${params.feedbackType}] ${params.title}`,
    '',
    ...(params.details ? [params.details, ''] : []),
    `From: ${submitter}`,
    `ID: ${params.feedbackId}`,
    `Time: ${timestamp}`,
  ]
  if (params.userEmail) {
    lines.push('', `Reply: mailto:${params.userEmail}`)
  }
  return lines.join('\n')
}

// --- Welcome email ---

export function buildWelcomeEmailHtml(params: {
  firstName: string
}): string {
  const name = escapeHtml(params.firstName)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:0 0 8px 8px;overflow:hidden;">
  <tr><td style="background:#090d13;padding:16px 40px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;padding-right:12px;font-size:36px;line-height:1;"><img src="https://lessonhollow.com/fennec-logo.png" alt="🦊" width="36" height="36" style="display:block;image-rendering:pixelated;" /></td>
      <td style="vertical-align:middle;"><span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:36px;">Lesson Hollow</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#090d13;">Welcome, ${name}!</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Your account is ready. Here is how to get your first curriculum going.</p>

    <h2 style="margin:0 0 12px;font-size:17px;color:#090d13;">Find a curriculum</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">Browse pre-made curriculums on <a href="https://lessonhollow.com/discover" style="color:#a35721;text-decoration:underline;">Discover</a> and add one to your account with a single click.</p>

    <h2 style="margin:0 0 12px;font-size:17px;color:#090d13;">Build your own</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">Create a curriculum from a CSV file. Two resources to help you get started:</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
      <li><a href="https://lessonhollow.com/help/tips/building-a-curriculum-file" style="color:#a35721;text-decoration:underline;">Building a curriculum file yourself</a></li>
      <li><a href="https://lessonhollow.com/help/llm/building-a-curriculum-file" style="color:#a35721;text-decoration:underline;">Building a curriculum file with an LLM</a></li>
    </ul>

    <h2 style="margin:0 0 12px;font-size:17px;color:#090d13;">Enroll in a curriculum</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">Once you have a curriculum, enroll a Player to start tracking progress. Open the curriculum page and click Enroll.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Reply to this email or reach us at <a href="mailto:hello@lessonhollow.com" style="color:#a35721;">hello@lessonhollow.com</a>.</p>
  </td></tr>
  <tr><td align="center" style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Lesson Hollow. Where lessons live.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildWelcomeEmailText(params: {
  firstName: string
}): string {
  return [
    `Welcome, ${params.firstName}!`,
    '',
    'Your Lesson Hollow account is ready. Here is how to get your first curriculum going.',
    '',
    'FIND A CURRICULUM',
    'Browse pre-made curriculums on Discover: https://lessonhollow.com/discover',
    '',
    'BUILD YOUR OWN',
    'Create a curriculum from a CSV file. Two guides to help:',
    '- Building a curriculum file yourself: https://lessonhollow.com/help/tips/building-a-curriculum-file',
    '- Building a curriculum file with an LLM: https://lessonhollow.com/help/llm/building-a-curriculum-file',
    '',
    'ENROLL IN A CURRICULUM',
    'Once you have a curriculum, enroll a learner to start tracking progress.',
    'Open the curriculum page and click Enroll.',
    '',
    'Questions? Email hello@lessonhollow.com',
  ].join('\n')
}

export async function sendWelcomeEmail(params: {
  email: string
  firstName: string
}): Promise<void> {
  console.log(`[welcome] Sending welcome email to ${params.email}`)

  const client = getSESClient()
  const senderEmail = process.env.AWS_SES_FROM_EMAIL

  if (!client || !senderEmail) {
    console.warn('[welcome] Email not configured, skipping SES delivery.')
    return
  }

  const command = new SendEmailCommand({
    Source: senderEmail,
    Destination: { ToAddresses: [params.email] },
    Message: {
      Subject: { Data: 'Welcome to Lesson Hollow', Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: buildWelcomeEmailHtml(params),
          Charset: 'UTF-8',
        },
        Text: {
          Data: buildWelcomeEmailText(params),
          Charset: 'UTF-8',
        },
      },
    },
    ReplyToAddresses: ['hello@lessonhollow.com'],
  })

  try {
    await client.send(command)
    console.log(`[welcome] Welcome email sent to ${params.email}`)
  } catch (err) {
    console.error('[welcome] Failed to send welcome email:', err)
  }
}

// --- Enrollment request email ---

export function buildEnrollmentRequestEmailHtml(params: {
  playerName: string
  curriculumName: string
  dashboardUrl: string
}): string {
  const player = escapeHtml(params.playerName)
  const curriculum = escapeHtml(params.curriculumName)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:0 0 8px 8px;overflow:hidden;">
  <tr><td align="center" style="background:#1c1e2e;padding:32px 40px 24px;">
    <span style="font-size:36px;line-height:1;">&#x1F98A;</span><br/>
    <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Lesson Hollow</span>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Enrollment request</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${player}</strong> wants to enroll in <strong>${curriculum}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
      Head to your dashboard to review and approve or deny the request.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#0D7C6B;border-radius:6px;">
        <a href="${escapeHtml(params.dashboardUrl)}" style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
          Review on Dashboard
        </a>
      </td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Reply to this email or reach us at <a href="mailto:hello@lessonhollow.com" style="color:#0D7C6B;">hello@lessonhollow.com</a>.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildEnrollmentRequestEmailText(params: {
  playerName: string
  curriculumName: string
  dashboardUrl: string
}): string {
  return [
    'Enrollment request',
    '',
    `${params.playerName} wants to enroll in ${params.curriculumName}.`,
    '',
    'Head to your dashboard to review and approve or deny the request.',
    '',
    `Dashboard: ${params.dashboardUrl}`,
    '',
    'Questions? Email hello@lessonhollow.com',
  ].join('\n')
}

export async function sendEnrollmentRequestEmail(params: {
  guideId: string
  playerName: string
  curriculumName: string
}): Promise<void> {
  console.log(`[enrollment-request] Sending notification for ${params.playerName} -> ${params.curriculumName}`)

  const client = getSESClient()
  const senderEmail = process.env.AWS_SES_FROM_EMAIL

  if (!client || !senderEmail) {
    console.warn('[enrollment-request] Email not configured, skipping SES delivery.')
    return
  }

  // Look up the guide's email address
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: guideData } = await admin.auth.admin.getUserById(params.guideId)
  const guideEmail = guideData?.user?.email

  if (!guideEmail) {
    console.warn('[enrollment-request] Guide email not found, skipping.')
    return
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`

  const command = new SendEmailCommand({
    Source: senderEmail,
    Destination: { ToAddresses: [guideEmail] },
    Message: {
      Subject: {
        Data: `[Lesson Hollow] ${params.playerName} wants to enroll in ${params.curriculumName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: buildEnrollmentRequestEmailHtml({ ...params, dashboardUrl }),
          Charset: 'UTF-8',
        },
        Text: {
          Data: buildEnrollmentRequestEmailText({ ...params, dashboardUrl }),
          Charset: 'UTF-8',
        },
      },
    },
    ReplyToAddresses: ['hello@lessonhollow.com'],
  })

  try {
    await client.send(command)
    console.log(`[enrollment-request] Email sent to ${guideEmail}`)
  } catch (err) {
    console.error('[enrollment-request] Failed to send email:', err)
  }
}

// --- Feedback email ---

export async function sendFeedbackNotification(params: {
  feedbackId: string
  feedbackType: string
  title: string
  details?: string
  userEmail?: string
  userId: string
}): Promise<void> {
  // Always log for auditability
  console.log(
    `[feedback] New ${params.feedbackType} feedback (#${params.feedbackId}) from ${params.userEmail ?? params.userId}: "${params.title}"`
  )

  const client = getSESClient()
  const senderEmail = process.env.AWS_SES_FROM_EMAIL
  const recipientEmail = process.env.FEEDBACK_NOTIFICATION_EMAIL

  if (!client || !senderEmail || !recipientEmail) {
    console.warn(
      '[feedback] Email not configured — skipping SES delivery. Set AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_FROM_EMAIL, and FEEDBACK_NOTIFICATION_EMAIL.'
    )
    return
  }

  const subject = `[Lesson Hollow ${params.feedbackType}] ${params.title}`

  const command = new SendEmailCommand({
    Source: senderEmail,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: buildFeedbackEmailHtml(params),
          Charset: 'UTF-8',
        },
        Text: {
          Data: buildFeedbackEmailText(params),
          Charset: 'UTF-8',
        },
      },
    },
    ...(params.userEmail ? { ReplyToAddresses: [params.userEmail] } : {}),
  })

  try {
    await client.send(command)
    console.log(
      `[feedback] Notification email sent for feedback #${params.feedbackId}`
    )
  } catch (err) {
    console.error('[feedback] Failed to send notification email:', err)
  }
}
