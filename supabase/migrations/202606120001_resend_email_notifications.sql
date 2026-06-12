CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'notification',
  status TEXT NOT NULL DEFAULT 'processing',
  provider_message_id TEXT,
  error_message TEXT,
  village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  site_viewing_id UUID REFERENCES public.site_viewings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_logs_status_check
    CHECK (status IN ('processing', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_notification_recipient_unique
  ON public.email_logs(notification_id, recipient_email)
  WHERE notification_id IS NOT NULL AND recipient_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_logs_notification_id_idx
  ON public.email_logs(notification_id);

CREATE INDEX IF NOT EXISTS email_logs_status_created_at_idx
  ON public.email_logs(status, created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_logs FROM anon, authenticated;
