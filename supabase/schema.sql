-- Supabase SQL Schema for iReserve Smart Village Reservation System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================
-- 1. PROFILES TABLE
-- ====================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('super_admin', 'village_admin', 'accounting', 'customer', 'architect')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 2. VILLAGES TABLE
-- ====================================================
CREATE TABLE public.villages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    hero_image_url TEXT,
    logo_url TEXT,
    starting_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 3. USER_VILLAGES TABLE (Role assignments to specific villages)
-- ====================================================
CREATE TABLE public.user_villages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('village_admin', 'accounting', 'architect')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user_id, village_id, role)
);

-- ====================================================
-- 4. BLUEPRINTS TABLE
-- ====================================================
CREATE TABLE public.blueprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    canvas_width INT NOT NULL DEFAULT 2000,
    canvas_height INT NOT NULL DEFAULT 2000,
    background_image_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 5. BLUEPRINT_OBJECTS TABLE
-- ====================================================
CREATE TABLE public.blueprint_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL CHECK (object_type IN ('road', 'lot', 'house', 'tree', 'amenity', 'label', 'zone', 'gate', 'guard_house', 'clubhouse', 'pool', 'park', 'street_light', 'landmark', 'sidewalk')),
    object_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    linked_property_id UUID, -- Will link to property after creation
    layer_order INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 6. PROPERTIES TABLE
-- ====================================================
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    blueprint_object_id UUID REFERENCES public.blueprint_objects(id) ON DELETE SET NULL,
    property_code TEXT NOT NULL,
    block_number TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    street_name TEXT,
    property_type TEXT NOT NULL CHECK (property_type IN ('lot', 'house_and_lot', 'townhouse', 'duplex', 'commercial_lot')),
    model_name TEXT,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL,
    reservation_fee NUMERIC(15, 2) NOT NULL DEFAULT 5000.00,
    lot_size NUMERIC(10, 2) NOT NULL,
    floor_area NUMERIC(10, 2),
    bedrooms INT DEFAULT 0,
    bathrooms INT DEFAULT 0,
    parking_slots INT DEFAULT 0,
    orientation TEXT,
    flood_risk TEXT NOT NULL DEFAULT 'low' CHECK (flood_risk IN ('low', 'medium', 'high')),
    sunlight_exposure TEXT NOT NULL DEFAULT 'balanced' CHECK (sunlight_exposure IN ('morning', 'afternoon', 'balanced', 'limited')),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'under_maintenance', 'hidden')),
    thumbnail_url TEXT,
    floor_plan_url TEXT,
    notes TEXT,
    maintenance_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(village_id, block_number, lot_number)
);

-- Add foreign key constraint to blueprint_objects for linked_property_id
ALTER TABLE public.blueprint_objects 
ADD CONSTRAINT fk_blueprint_objects_properties 
FOREIGN KEY (linked_property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

-- ====================================================
-- 7. PROPERTY_IMAGES TABLE
-- ====================================================
CREATE TABLE public.property_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT NOT NULL CHECK (image_type IN ('front_view', 'gallery', 'floor_plan', 'street_view')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 8. RESERVATIONS TABLE
-- ====================================================
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_code TEXT UNIQUE NOT NULL,
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_email TEXT,
    guest_name TEXT,
    guest_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'pending_documents', 'pending_verification', 'reserved', 'approved', 'rejected', 'cancelled', 'expired', 'converted_to_sale')),
    reservation_fee NUMERIC(15, 2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reserved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    payment_type TEXT CHECK (payment_type IN ('full_payment', 'partial_payment', 'installment')),
    total_contract_price NUMERIC(15, 2),
    downpayment_amount NUMERIC(15, 2),
    downpayment_percentage NUMERIC(5, 2),
    initial_amount_due NUMERIC(15, 2),
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    remaining_balance NUMERIC(15, 2),
    installment_term_months INT,
    monthly_payment NUMERIC(15, 2),
    next_due_date DATE,
    payment_plan_status TEXT DEFAULT 'not_started' CHECK (payment_plan_status IN ('not_started', 'pending_initial_payment', 'active', 'downpayment_completed', 'fully_paid', 'overdue', 'cancelled', 'defaulted')),
    payment_amount_indicator TEXT DEFAULT 'not_paid' CHECK (payment_amount_indicator IN ('not_paid', 'insufficient_payment', 'initial_payment_completed', 'partially_paid', 'fully_paid', 'overdue', 'overpaid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('full_payment', 'partial_payment', 'installment')),
    total_contract_price NUMERIC(15, 2) NOT NULL,
    reservation_fee NUMERIC(15, 2) NOT NULL,
    downpayment_amount NUMERIC(15, 2) DEFAULT 0,
    downpayment_percentage NUMERIC(5, 2) DEFAULT 0,
    initial_amount_due NUMERIC(15, 2) NOT NULL,
    principal_balance NUMERIC(15, 2) NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    remaining_balance NUMERIC(15, 2) NOT NULL,
    installment_term_months INT,
    monthly_payment NUMERIC(15, 2),
    interest_rate NUMERIC(5, 2) DEFAULT 0,
    start_date DATE,
    next_due_date DATE,
    initial_payment_progress NUMERIC(6, 2) DEFAULT 0,
    total_payment_progress NUMERIC(6, 2) DEFAULT 0,
    payment_amount_indicator TEXT DEFAULT 'not_paid' CHECK (payment_amount_indicator IN ('not_paid', 'insufficient_payment', 'initial_payment_completed', 'partially_paid', 'fully_paid', 'overdue', 'overpaid')),
    overdue_count INT DEFAULT 0,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending_initial_payment' CHECK (status IN ('pending_initial_payment', 'active', 'downpayment_completed', 'fully_paid', 'overdue', 'cancelled', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.payment_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    due_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount_due NUMERIC(15, 2) NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    remaining_due NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'waived', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 9. PAYMENTS TABLE
-- ====================================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
    payment_schedule_id UUID REFERENCES public.payment_schedule(id) ON DELETE SET NULL,
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('gcash', 'maya', 'bank_transfer', 'cash', 'paymongo', 'manual_upload')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending_verification', 'verified', 'rejected', 'refunded', 'partially_paid', 'overdue')),
    payment_purpose TEXT DEFAULT 'reservation_fee' CHECK (payment_purpose IN ('reservation_fee', 'downpayment', 'full_payment', 'monthly_installment', 'partial_balance_payment', 'refund')),
    reference_number TEXT,
    official_receipt_number TEXT,
    proof_url TEXT,
    accounting_notes TEXT,
    rejection_reason TEXT,
    maximum_payable_amount NUMERIC(15, 2),
    submitted_amount NUMERIC(15, 2),
    accepted_amount NUMERIC(15, 2),
    excess_amount NUMERIC(15, 2) DEFAULT 0,
    is_overpayment BOOLEAN DEFAULT FALSE,
    overpayment_handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    overpayment_note TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 10. DOCUMENTS TABLE
-- ====================================================
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- ====================================================
-- 11. SITE_VIEWINGS TABLE
-- ====================================================
CREATE TABLE public.site_viewings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    preferred_date DATE NOT NULL,
    preferred_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 12. INQUIRIES TABLE
-- ====================================================
CREATE TABLE public.inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    payment_type TEXT CHECK (payment_type IN ('full_payment', 'partial_payment', 'installment')),
    preferred_installment_term INT,
    estimated_budget NUMERIC(15, 2),
    inquiry_status TEXT DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 13. NOTIFICATIONS TABLE
-- ====================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 14. AUDIT_LOGS TABLE
-- ====================================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================
-- 15. REFUNDS TABLE
-- ====================================================
CREATE TABLE public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'processed')),
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- ====================================================
-- SECURITY: ROW LEVEL SECURITY & CUSTOM HELPER FUNCTIONS
-- ====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;


-- 1. Helper Function: Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Helper Function: Check user's overall role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT SECURITY DEFINER AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql;

-- 3. Helper Function: Check if user has access to a specific village (as admin, accounting, or architect)
CREATE OR REPLACE FUNCTION public.has_village_access(village_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  -- Super admin has access to everything
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Check user_villages mapping
  RETURN EXISTS (
    SELECT 1 FROM public.user_villages 
    WHERE user_id = auth.uid() AND user_villages.village_id = $1
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Helper Function: Check if user has a specific village role
CREATE OR REPLACE FUNCTION public.has_village_role(village_id UUID, role_name TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_villages 
    WHERE user_id = auth.uid() 
      AND user_villages.village_id = $1 
      AND user_villages.role = $2
  );
END;
$$ LANGUAGE plpgsql;


-- ====================================================
-- RLS POLICIES FOR EACH TABLE
-- ====================================================

-- --- profiles POLICIES ---
CREATE POLICY profiles_all_super_admin ON public.profiles FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY profiles_read_all ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- --- villages POLICIES ---
CREATE POLICY villages_super_admin ON public.villages FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY villages_read_public ON public.villages FOR SELECT TO public USING (status = 'active');
CREATE POLICY villages_admin_read_inactive ON public.villages FOR SELECT TO authenticated USING (public.has_village_access(id));

-- --- user_villages POLICIES ---
CREATE POLICY user_villages_super_admin ON public.user_villages FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY user_villages_read_self ON public.user_villages FOR SELECT TO authenticated USING (user_id = auth.uid());

-- --- blueprints POLICIES ---
CREATE POLICY blueprints_super_admin ON public.blueprints FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY blueprints_architect_all ON public.blueprints FOR ALL TO authenticated USING (public.has_village_role(village_id, 'architect'));
CREATE POLICY blueprints_read_public ON public.blueprints FOR SELECT TO public USING (status = 'published');
CREATE POLICY blueprints_read_admin ON public.blueprints FOR SELECT TO authenticated USING (public.has_village_access(village_id));

-- --- blueprint_objects POLICIES ---
CREATE POLICY blueprint_objects_super_admin ON public.blueprint_objects FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY blueprint_objects_architect_all ON public.blueprint_objects FOR ALL TO authenticated USING (public.has_village_role(village_id, 'architect'));
CREATE POLICY blueprint_objects_village_admin_link_update ON public.blueprint_objects FOR UPDATE TO authenticated
    USING (public.has_village_role(village_id, 'village_admin'))
    WITH CHECK (public.has_village_role(village_id, 'village_admin'));
CREATE POLICY blueprint_objects_read_public ON public.blueprint_objects FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.blueprints WHERE id = blueprint_id AND status = 'published')
);
CREATE POLICY blueprint_objects_read_admin ON public.blueprint_objects FOR SELECT TO authenticated USING (public.has_village_access(village_id));

-- --- properties POLICIES ---
CREATE POLICY properties_super_admin ON public.properties FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY properties_admin_all ON public.properties FOR ALL TO authenticated USING (public.has_village_role(village_id, 'village_admin'));
CREATE POLICY properties_customer_reserve_update ON public.properties FOR UPDATE TO authenticated
    USING (status = 'available')
    WITH CHECK (status = 'reserved');
CREATE POLICY properties_read_public ON public.properties FOR SELECT TO public USING (status != 'hidden');
CREATE POLICY properties_read_admin ON public.properties FOR SELECT TO authenticated USING (public.has_village_access(village_id));

-- --- property_images POLICIES ---
CREATE POLICY property_images_super_admin ON public.property_images FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY property_images_admin_all ON public.property_images FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND public.has_village_role(village_id, 'village_admin'))
);
CREATE POLICY property_images_read_public ON public.property_images FOR SELECT TO public USING (TRUE);

-- --- reservations POLICIES ---
CREATE POLICY reservations_super_admin ON public.reservations FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY reservations_admin_read_write ON public.reservations FOR ALL TO authenticated USING (
    public.has_village_role(village_id, 'village_admin') OR public.has_village_role(village_id, 'accounting')
);
CREATE POLICY reservations_customer_read_write ON public.reservations FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY reservations_customer_insert ON public.reservations FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY reservations_guest_insert ON public.reservations FOR INSERT TO public WITH CHECK (customer_id IS NULL);

-- --- payment_plans POLICIES ---
CREATE POLICY payment_plans_super_admin ON public.payment_plans FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY payment_plans_admin_read ON public.payment_plans FOR SELECT TO authenticated USING (public.has_village_access(village_id));
CREATE POLICY payment_plans_accounting_all ON public.payment_plans FOR ALL TO authenticated USING (public.has_village_role(village_id, 'accounting'));
CREATE POLICY payment_plans_customer_read ON public.payment_plans FOR SELECT TO authenticated USING (customer_id = auth.uid());

-- --- payment_schedule POLICIES ---
CREATE POLICY payment_schedule_super_admin ON public.payment_schedule FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY payment_schedule_admin_read ON public.payment_schedule FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND public.has_village_access(village_id))
);
CREATE POLICY payment_schedule_accounting_all ON public.payment_schedule FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND public.has_village_role(village_id, 'accounting'))
);
CREATE POLICY payment_schedule_customer_read ON public.payment_schedule FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND customer_id = auth.uid())
);

-- --- payments POLICIES ---
CREATE POLICY payments_super_admin ON public.payments FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY payments_accounting_all ON public.payments FOR ALL TO authenticated USING (public.has_village_role(village_id, 'accounting'));
CREATE POLICY payments_customer_all ON public.payments FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY payments_customer_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

-- --- documents POLICIES ---
CREATE POLICY documents_super_admin ON public.documents FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY documents_admin_read ON public.documents FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.reservations WHERE id = reservation_id AND public.has_village_access(village_id))
);
CREATE POLICY documents_customer_all ON public.documents FOR ALL TO authenticated USING (customer_id = auth.uid());

-- --- site_viewings POLICIES ---
CREATE POLICY site_viewings_super_admin ON public.site_viewings FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY site_viewings_admin_all ON public.site_viewings FOR ALL TO authenticated USING (public.has_village_role(village_id, 'village_admin'));
CREATE POLICY site_viewings_customer_all ON public.site_viewings FOR ALL TO authenticated USING (customer_id = auth.uid());
CREATE POLICY site_viewings_guest_insert ON public.site_viewings FOR INSERT TO public WITH CHECK (customer_id IS NULL);

-- --- inquiries POLICIES ---
CREATE POLICY inquiries_super_admin ON public.inquiries FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY inquiries_admin_all ON public.inquiries FOR ALL TO authenticated USING (public.has_village_role(village_id, 'village_admin'));
CREATE POLICY inquiries_customer_all ON public.inquiries FOR ALL TO authenticated USING (customer_id = auth.uid());
CREATE POLICY inquiries_guest_insert ON public.inquiries FOR INSERT TO public WITH CHECK (TRUE);

-- --- notifications POLICIES ---
CREATE POLICY notifications_user_all ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid());

-- --- audit_logs POLICIES ---
CREATE POLICY audit_logs_super_admin ON public.audit_logs FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY audit_logs_admin_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_village_access(village_id));
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated USING (public.has_village_access(village_id));

-- --- refunds POLICIES ---
CREATE POLICY refunds_super_admin ON public.refunds FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY refunds_accounting_all ON public.refunds FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND public.has_village_role(village_id, 'accounting'))
);
CREATE POLICY refunds_customer_read ON public.refunds FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND customer_id = auth.uid())
);


-- ====================================================
-- TRIGGERS TO SYNC PROFILES AND STAMP TIMESTAMPS
-- ====================================================

-- 1. Sync public.profiles on new Auth signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Valued Customer'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
