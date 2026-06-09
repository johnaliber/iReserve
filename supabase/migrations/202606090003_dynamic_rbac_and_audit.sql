-- Dynamic RBAC, access scopes, account status, and richer audit logs.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'inactive', 'suspended'));

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  permission_state TEXT NOT NULL DEFAULT 'allow',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, permission_id),
  CONSTRAINT user_permissions_state_check CHECK (permission_state IN ('allow', 'deny'))
);

CREATE TABLE IF NOT EXISTS public.user_access_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  village_id UUID REFERENCES public.villages(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_access_scopes_type_check CHECK (scope_type IN ('global', 'village', 'property', 'own_records')),
  CONSTRAINT user_access_scopes_target_check CHECK (
    (scope_type = 'global' AND village_id IS NULL AND property_id IS NULL) OR
    (scope_type = 'own_records' AND village_id IS NULL AND property_id IS NULL) OR
    (scope_type = 'village' AND village_id IS NOT NULL AND property_id IS NULL) OR
    (scope_type = 'property' AND property_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_access_scopes_unique_global
  ON public.user_access_scopes(user_id, scope_type)
  WHERE village_id IS NULL AND property_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_access_scopes_unique_village
  ON public.user_access_scopes(user_id, scope_type, village_id)
  WHERE village_id IS NOT NULL AND property_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_access_scopes_unique_property
  ON public.user_access_scopes(user_id, scope_type, property_id)
  WHERE property_id IS NOT NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

INSERT INTO public.roles (name, display_name, description, is_system_role)
VALUES
  ('super_admin', 'Super Admin', 'Full system access across all villages and modules.', TRUE),
  ('village_admin', 'Village Admin', 'Manages assigned villages, properties, reservations, and customer records.', TRUE),
  ('accounting', 'Accounting', 'Manages payments, ledgers, documents, refunds, and financial reports.', TRUE),
  ('architect', 'Architect', 'Manages assigned village blueprints and map designs.', TRUE),
  ('customer', 'Customer', 'Manages their own reservations, documents, and payments.', TRUE),
  ('guest', 'Guest', 'Public read-only and inquiry access.', TRUE)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role,
  updated_at = NOW();

INSERT INTO public.permissions (name, display_name, description, category)
VALUES
  ('users.view','View users','View user profiles and assignments.','User Management'),
  ('users.create','Create users','Create user accounts manually.','User Management'),
  ('users.update','Update users','Edit user profiles.','User Management'),
  ('users.delete','Delete users','Remove user accounts.','User Management'),
  ('users.assign_role','Assign roles','Change a user role.','User Management'),
  ('users.assign_scope','Assign access scopes','Manage village, property, global, and own-record scopes.','User Management'),
  ('users.deactivate','Deactivate users','Suspend, deactivate, or reactivate accounts.','User Management'),
  ('villages.view','View villages','View village communities.','Village Management'),
  ('villages.create','Create villages','Create village communities.','Village Management'),
  ('villages.update','Update villages','Edit village communities.','Village Management'),
  ('villages.delete','Delete villages','Delete village communities.','Village Management'),
  ('villages.archive','Archive villages','Archive village communities.','Village Management'),
  ('properties.view','View properties','View property inventory.','Property Management'),
  ('properties.create','Create properties','Create property records.','Property Management'),
  ('properties.update','Update properties','Edit property records.','Property Management'),
  ('properties.delete','Delete properties','Delete property records.','Property Management'),
  ('properties.update_status','Update property status','Change property availability status.','Property Management'),
  ('properties.manage_pricing','Manage pricing','Manage property prices and payment defaults.','Property Management'),
  ('reservations.view','View reservations','View reservation records.','Reservation Management'),
  ('reservations.create','Create reservations','Create reservation records.','Reservation Management'),
  ('reservations.update','Update reservations','Edit reservation records.','Reservation Management'),
  ('reservations.approve','Approve reservations','Approve reservation requests.','Reservation Management'),
  ('reservations.reject','Reject reservations','Reject reservation requests.','Reservation Management'),
  ('reservations.cancel','Cancel reservations','Cancel reservations.','Reservation Management'),
  ('reservations.expire','Expire reservations','Expire unpaid reservations.','Reservation Management'),
  ('payments.view','View payments','View payments and financial records.','Payment / Ledger'),
  ('payments.verify','Verify payments','Verify uploaded payments.','Payment / Ledger'),
  ('payments.reject','Reject payments','Reject uploaded payments.','Payment / Ledger'),
  ('payments.record_manual','Record manual payments','Record cash or manual payments.','Payment / Ledger'),
  ('payments.refund','Refund payments','Create and process refunds.','Payment / Ledger'),
  ('ledger.customer_accounts.view','View customer ledgers','View customer balances and schedules.','Payment / Ledger'),
  ('ledger.receipts.view','View receipt ledger','View and audit payment receipts.','Payment / Ledger'),
  ('ledger.documents.view','View customer documents','View submitted customer documents.','Payment / Ledger'),
  ('ledger.documents.approve','Approve customer documents','Approve submitted documents.','Payment / Ledger'),
  ('ledger.documents.reject','Reject customer documents','Reject submitted documents.','Payment / Ledger'),
  ('blueprints.view','View blueprints','View assigned blueprint designs.','Blueprint Management'),
  ('blueprints.create_draft','Create blueprint drafts','Create draft blueprints.','Blueprint Management'),
  ('blueprints.edit','Edit blueprints','Edit blueprint objects and layout.','Blueprint Management'),
  ('blueprints.publish','Publish blueprints','Publish blueprint designs.','Blueprint Management'),
  ('blueprints.archive','Archive blueprints','Archive blueprint designs.','Blueprint Management'),
  ('blueprints.delete','Delete blueprints','Delete blueprint designs.','Blueprint Management'),
  ('reports.view','View reports','View operational reports.','Reports'),
  ('reports.export','Export reports','Export report data.','Reports'),
  ('reports.sales','View sales reports','View sales reports.','Reports'),
  ('reports.reservations','View reservation reports','View reservation reports.','Reports'),
  ('reports.payments','View payment reports','View payment reports.','Reports'),
  ('reports.audit','View audit reports','View audit-related reports.','Reports'),
  ('audit_logs.view','View audit logs','View user behavior and system audit logs.','Audit Logs'),
  ('audit_logs.export','Export audit logs','Export audit logs.','Audit Logs'),
  ('settings.view','View settings','View system settings.','System Settings'),
  ('settings.update','Update settings','Update system settings.','System Settings')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- System role defaults. Super admin is handled as an unconditional allow.
WITH grants(role_name, permission_name) AS (
  VALUES
    ('village_admin','users.view'),('village_admin','users.update'),('village_admin','users.assign_scope'),
    ('village_admin','villages.view'),('village_admin','villages.update'),
    ('village_admin','properties.view'),('village_admin','properties.create'),('village_admin','properties.update'),
    ('village_admin','properties.update_status'),('village_admin','properties.manage_pricing'),
    ('village_admin','reservations.view'),('village_admin','reservations.update'),('village_admin','reservations.approve'),
    ('village_admin','reservations.reject'),('village_admin','reservations.cancel'),('village_admin','reservations.expire'),
    ('village_admin','payments.view'),('village_admin','payments.verify'),('village_admin','payments.reject'),
    ('village_admin','payments.record_manual'),('village_admin','ledger.customer_accounts.view'),
    ('village_admin','ledger.receipts.view'),('village_admin','ledger.documents.view'),
    ('village_admin','ledger.documents.approve'),('village_admin','ledger.documents.reject'),
    ('village_admin','blueprints.view'),('village_admin','reports.view'),('village_admin','reports.export'),
    ('village_admin','reports.sales'),('village_admin','reports.reservations'),('village_admin','reports.payments'),
    ('village_admin','audit_logs.view'),('village_admin','settings.view'),('village_admin','settings.update'),
    ('accounting','payments.view'),('accounting','payments.verify'),('accounting','payments.reject'),
    ('accounting','payments.record_manual'),('accounting','payments.refund'),
    ('accounting','ledger.customer_accounts.view'),('accounting','ledger.receipts.view'),
    ('accounting','ledger.documents.view'),('accounting','ledger.documents.approve'),
    ('accounting','ledger.documents.reject'),('accounting','reports.view'),('accounting','reports.export'),
    ('accounting','reports.sales'),('accounting','reports.payments'),('accounting','audit_logs.view'),
    ('architect','villages.view'),('architect','properties.view'),('architect','blueprints.view'),
    ('architect','blueprints.create_draft'),('architect','blueprints.edit'),('architect','blueprints.publish'),
    ('architect','blueprints.archive'),
    ('customer','villages.view'),('customer','properties.view'),('customer','reservations.view'),
    ('customer','reservations.create'),('customer','payments.view'),('customer','ledger.documents.view'),
    ('guest','villages.view'),('guest','properties.view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM grants
JOIN public.roles roles ON roles.name = grants.role_name
JOIN public.permissions permissions ON permissions.name = grants.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Backfill scopes while retaining user_villages for existing application paths.
INSERT INTO public.user_access_scopes (user_id, scope_type)
SELECT id, 'global' FROM public.profiles WHERE role = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_access_scopes (user_id, scope_type)
SELECT id, 'own_records' FROM public.profiles WHERE role IN ('customer', 'guest')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_access_scopes (user_id, scope_type, village_id)
SELECT DISTINCT user_id, 'village', village_id FROM public.user_villages
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role TEXT;
  explicit_state TEXT;
BEGIN
  SELECT role INTO profile_role FROM public.profiles WHERE id = p_user_id AND status = 'active';
  IF profile_role IS NULL THEN RETURN FALSE; END IF;
  IF profile_role = 'super_admin' THEN RETURN TRUE; END IF;

  SELECT up.permission_state INTO explicit_state
  FROM public.user_permissions up
  JOIN public.permissions p ON p.id = up.permission_id
  WHERE up.user_id = p_user_id AND p.name = p_permission_name;

  IF explicit_state = 'deny' THEN RETURN FALSE; END IF;
  IF explicit_state = 'allow' THEN RETURN TRUE; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = profile_role AND p.name = p_permission_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_scope_access(
  p_user_id UUID,
  p_scope_type TEXT,
  p_village_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin' AND status = 'active') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_access_scopes scope
    WHERE scope.user_id = p_user_id
      AND (
        scope.scope_type = 'global'
        OR (scope.scope_type = 'own_records' AND p_scope_type = 'own_records')
        OR (scope.scope_type = 'village' AND scope.village_id = p_village_id)
        OR (scope.scope_type = 'property' AND scope.property_id = p_property_id)
      )
  );
END;
$$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_authenticated_read ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY permissions_authenticated_read ON public.permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY role_permissions_authenticated_read ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY user_permissions_self_read ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY user_access_scopes_self_read ON public.user_access_scopes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY roles_super_admin_all ON public.roles FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY permissions_super_admin_all ON public.permissions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY role_permissions_super_admin_all ON public.role_permissions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY user_permissions_super_admin_all ON public.user_permissions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY user_access_scopes_super_admin_all ON public.user_access_scopes FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_scope_access(UUID, TEXT, UUID, UUID) TO authenticated;
