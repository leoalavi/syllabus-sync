-- Harden internal audit configuration by enabling RLS on the retention settings table.
-- This table is only meant for service-role and SECURITY DEFINER access.

ALTER TABLE IF EXISTS public.audit_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_settings FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_settings'
      AND policyname = 'Service role can manage audit settings'
  ) THEN
    CREATE POLICY "Service role can manage audit settings"
      ON public.audit_settings
      FOR ALL
      TO public
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;

COMMENT ON TABLE public.audit_settings IS
  'Internal audit-log retention configuration. Direct access is limited to service_role and SECURITY DEFINER routines.';
