import 'server-only';

import path from 'node:path';

import smtpClient from './smtpClient';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRecipients(to) {
  const values = Array.isArray(to) ? to : [to];
  return [...new Set(
    values
      .map((email) => String(email || '').trim().toLowerCase())
      .filter((email) => EMAIL_PATTERN.test(email))
  )];
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo
}) {
  const recipients = normalizeRecipients(to);

  if (recipients.length === 0) {
    return { success: false, skipped: true, reason: 'missing_or_invalid_recipient' };
  }

  if (!smtpClient || !process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_APP_PASSWORD) {
    return { success: false, skipped: true, reason: 'gmail_smtp_not_configured', recipients };
  }

  const senderEmail = process.env.GMAIL_SMTP_USER;
  const senderName = process.env.GMAIL_SMTP_FROM_NAME?.replaceAll('"', '').trim();
  const from = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

  try {
    const info = await smtpClient.sendMail({
      from,
      to: recipients,
      subject,
      html,
      text,
      replyTo: replyTo || process.env.GMAIL_SMTP_REPLY_TO || senderEmail,
      attachments: [
        {
          filename: 'ireserve-logo.png',
          path: path.join(process.cwd(), 'public', 'brand', 'ireserve-logo.png'),
          cid: 'ireserve-logo'
        }
      ]
    });

    const accepted = normalizeRecipients(info.accepted || []);
    const rejected = normalizeRecipients(info.rejected || []);
    const allRecipientsAccepted = recipients.every((email) => accepted.includes(email));

    if (!allRecipientsAccepted) {
      const rejectedList = rejected.length > 0
        ? rejected.join(', ')
        : recipients.filter((email) => !accepted.includes(email)).join(', ');
      console.error(`[email] Gmail SMTP did not accept every recipient: ${rejectedList}`);
      return {
        success: false,
        error: `Gmail SMTP rejected or did not accept: ${rejectedList}`,
        id: info.messageId || null,
        recipients,
        accepted,
        rejected
      };
    }

    return {
      success: true,
      id: info.messageId || null,
      recipients,
      accepted,
      rejected,
      response: info.response || null
    };
  } catch (error) {
    console.error('[email] Gmail SMTP delivery failed:', error instanceof Error ? error.message : 'Unknown error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email delivery error',
      recipients
    };
  }
}

export { normalizeRecipients };
