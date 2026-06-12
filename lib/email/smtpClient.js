import 'server-only';

import nodemailer from 'nodemailer';

const user = process.env.GMAIL_SMTP_USER;
const appPassword = process.env.GMAIL_SMTP_APP_PASSWORD;
const host = process.env.GMAIL_SMTP_HOST;
const port = Number.parseInt(process.env.GMAIL_SMTP_PORT, 10);
const secureValue = process.env.GMAIL_SMTP_SECURE;
const secure = secureValue === 'true';
const hasValidConfig = Boolean(
  user
  && appPassword
  && host
  && Number.isInteger(port)
  && port > 0
  && ['true', 'false'].includes(secureValue)
);

if (!hasValidConfig && process.env.NODE_ENV !== 'test') {
  console.warn('[email] Gmail SMTP environment configuration is incomplete or invalid. Email delivery will be skipped.');
}

const smtpClient = hasValidConfig
  ? nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: appPassword.replace(/\s+/g, '')
      }
    })
  : null;

export default smtpClient;
