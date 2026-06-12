DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_logs'
      AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE public.email_logs
      RENAME COLUMN resend_email_id TO provider_message_id;
  END IF;
END
$$;
