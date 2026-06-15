import 'server-only';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || 'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function notificationEmail({
  title,
  message,
  type = 'notification',
  userName,
  actionUrl = '/customer/notifications',
  actionLabel = 'Open iReserve',
  actionHelpText = 'Log in to your iReserve account to view complete details.',
  supportEmail = process.env.GMAIL_SMTP_REPLY_TO || process.env.GMAIL_SMTP_USER
}) {
  const appUrl = getAppUrl();
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeName = escapeHtml(userName || 'iReserve user');
  const safeType = escapeHtml(String(type).replaceAll('_', ' '));
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionHelpText = escapeHtml(actionHelpText);
  const safeSupport = escapeHtml(supportEmail || 'the iReserve support team');
  const destination = actionUrl?.startsWith('http')
    ? actionUrl
    : `${appUrl}${actionUrl?.startsWith('/') ? actionUrl : `/${actionUrl || ''}`}`;
  const logoUrl = 'cid:ireserve-logo';

  const subject = `iReserve: ${title}`;
  const text = [
    `Hello ${userName || 'there'},`,
    '',
    title,
    message,
    '',
    `${actionLabel}: ${destination}`,
    `Support: ${supportEmail || 'Contact the iReserve support team.'}`
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f1f5f3;font-family:Arial,Helvetica,sans-serif;color:#17211d;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">iReserve ${safeType}: ${safeTitle}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f3;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border:1px solid #dbe7e1;border-radius:22px;background:#ffffff;">
            <tr>
              <td style="height:10px;background:#00b77b;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:30px 28px 14px;">
                <img src="${logoUrl}" width="150" alt="iReserve" style="display:block;max-width:150px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 34px;text-align:center;">
                <p style="margin:0 0 10px;color:#047857;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">System Notification</p>
                <h1 style="margin:0;color:#17211d;font-size:26px;line-height:1.25;">${safeTitle}</h1>
                <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.65;">Hello ${safeName},</p>
                <p style="margin:8px 0 0;color:#334155;font-size:15px;line-height:1.65;">${safeMessage}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto 0;">
                  <tr>
                    <td style="border-radius:999px;background:#00a876;">
                      <a href="${escapeHtml(destination)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${safeActionLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.6;">${safeActionHelpText}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;color:#64748b;font-size:11px;line-height:1.6;">
                Need help? Contact ${safeSupport}.<br>
                This is a transactional system email from iReserve.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
