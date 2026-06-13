DO $$
DECLARE
  realtime_table TEXT;
  realtime_tables TEXT[] := ARRAY[
    'villages',
    'profiles',
    'properties',
    'reservations',
    'payments',
    'payment_plans',
    'payment_schedule',
    'documents',
    'site_viewings',
    'inquiries',
    'notifications',
    'blueprints',
    'blueprint_objects',
    'conversations',
    'conversation_messages',
    'conversation_participants',
    'audit_logs',
    'refunds'
  ];
BEGIN
  FOREACH realtime_table IN ARRAY realtime_tables LOOP
    IF to_regclass(format('public.%I', realtime_table)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = realtime_table
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    END IF;
  END LOOP;
END
$$;
