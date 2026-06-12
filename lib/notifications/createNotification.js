import 'server-only';

import { getUserEmail } from '@/lib/email/getNotificationRecipients';
import { sendEmail } from '@/lib/email/sendEmail';
import { notificationEmail } from '@/lib/email/templates/notificationEmail';

function trimError(value) {
  return String(value || '').slice(0, 500);
}

async function claimEmailDelivery(admin, {
  notificationId,
  recipientUserId,
  recipientEmail,
  subject,
  eventType,
  villageId,
  reservationId,
  paymentId,
  siteViewingId
}) {
  const { data, error } = await admin
    .from('email_logs')
    .insert({
      notification_id: notificationId,
      recipient_user_id: recipientUserId || null,
      recipient_email: recipientEmail || null,
      subject,
      event_type: eventType || 'notification',
      status: 'processing',
      village_id: villageId || null,
      reservation_id: reservationId || null,
      payment_id: paymentId || null,
      site_viewing_id: siteViewingId || null
    })
    .select('id')
    .single();

  if (error?.code === '23505') return { duplicate: true };
  if (error) {
    console.error('[email] Could not create email log:', error.message);
    return { unavailable: true };
  }
  return { id: data.id };
}

async function finishEmailLog(admin, logId, result) {
  if (!logId) return;
  const status = result.success ? 'sent' : result.skipped ? 'skipped' : 'failed';
  const { error } = await admin
    .from('email_logs')
    .update({
      status,
      provider_message_id: result.id || null,
      error_message: result.success ? null : trimError(result.error || result.reason),
      updated_at: new Date().toISOString()
    })
    .eq('id', logId);

  if (error) console.error('[email] Could not update email log:', error.message);
}

export async function createNotification({
  admin,
  userId,
  title,
  message,
  type,
  villageId,
  metadata = {},
  actionUrl = '/customer/notifications',
  emailEnabled = true
}) {
  if (!admin) throw new Error('An admin Supabase client is required.');

  const { data: notification, error } = await admin
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type
    })
    .select()
    .single();

  if (error || !notification) {
    throw new Error(error?.message || 'Notification could not be created.');
  }

  if (!emailEnabled) return { notification, email: { skipped: true, reason: 'disabled' } };

  try {
    const recipient = await getUserEmail(admin, userId);
    const email = notificationEmail({
      title,
      message,
      type,
      userName: recipient?.full_name,
      actionUrl,
      supportEmail: process.env.GMAIL_SMTP_REPLY_TO || process.env.GMAIL_SMTP_USER
    });
    const claim = await claimEmailDelivery(admin, {
      notificationId: notification.id,
      recipientUserId: userId,
      recipientEmail: recipient?.email,
      subject: email.subject,
      eventType: type,
      villageId,
      reservationId: metadata.reservationId,
      paymentId: metadata.paymentId,
      siteViewingId: metadata.siteViewingId
    });

    if (claim.duplicate) {
      return { notification, email: { skipped: true, reason: 'duplicate' } };
    }
    if (claim.unavailable) {
      return { notification, email: { skipped: true, reason: 'email_log_unavailable' } };
    }

    const result = recipient?.email
      ? await sendEmail({
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text
        })
      : { success: false, skipped: true, reason: 'missing_or_invalid_recipient' };

    await finishEmailLog(admin, claim.id, result);
    return { notification, email: result };
  } catch (emailError) {
    console.error('[email] Notification email failed safely:', emailError instanceof Error ? emailError.message : 'Unknown error');
    return {
      notification,
      email: { success: false, error: 'Email delivery failed safely.' }
    };
  }
}

export async function createNotifications({
  admin,
  recipients = [],
  ...notification
}) {
  const recipientIds = [...new Set(
    recipients
      .map((recipient) => typeof recipient === 'string' ? recipient : recipient?.id)
      .filter(Boolean)
  )];

  const results = await Promise.allSettled(
    recipientIds.map((userId) => createNotification({
      admin,
      userId,
      ...notification
    }))
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error('[notification] Recipient notification failed safely:', result.reason?.message || result.reason);
    }
  });

  return {
    attempted: recipientIds.length,
    created: results.filter((result) => result.status === 'fulfilled' && result.value?.notification).length,
    emailsSent: results.filter((result) => result.status === 'fulfilled' && result.value?.email?.success).length
  };
}
