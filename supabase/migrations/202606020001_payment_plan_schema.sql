-- iReserve payment plans, payment schedules, indicators, and overpayment support.
-- Safe to run against an existing project: columns/tables are guarded with IF NOT EXISTS.

ALTER TABLE public.inquiries
ADD COLUMN IF NOT EXISTS payment_type TEXT,
ADD COLUMN IF NOT EXISTS preferred_installment_term INT,
ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS inquiry_status TEXT DEFAULT 'new';

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS payment_type TEXT,
ADD COLUMN IF NOT EXISTS total_contract_price NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS downpayment_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS downpayment_percentage NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS initial_amount_due NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS installment_term_months INT,
ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS next_due_date DATE,
ADD COLUMN IF NOT EXISTS payment_plan_status TEXT DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS payment_amount_indicator TEXT DEFAULT 'not_paid';

CREATE TABLE IF NOT EXISTS public.payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL,
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
    payment_amount_indicator TEXT DEFAULT 'not_paid',
    overdue_count INT DEFAULT 0,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending_initial_payment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    due_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount_due NUMERIC(15, 2) NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    remaining_due NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_schedule_id UUID REFERENCES public.payment_schedule(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_purpose TEXT DEFAULT 'reservation_fee',
ADD COLUMN IF NOT EXISTS maximum_payable_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS submitted_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS accepted_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS excess_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_overpayment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overpayment_handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS overpayment_note TEXT;

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_plans' AND policyname = 'payment_plans_super_admin') THEN
    CREATE POLICY payment_plans_super_admin ON public.payment_plans FOR ALL TO authenticated USING (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_plans' AND policyname = 'payment_plans_admin_read') THEN
    CREATE POLICY payment_plans_admin_read ON public.payment_plans FOR SELECT TO authenticated USING (public.has_village_access(village_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_plans' AND policyname = 'payment_plans_accounting_all') THEN
    CREATE POLICY payment_plans_accounting_all ON public.payment_plans FOR ALL TO authenticated USING (public.has_village_role(village_id, 'accounting'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_plans' AND policyname = 'payment_plans_customer_read') THEN
    CREATE POLICY payment_plans_customer_read ON public.payment_plans FOR SELECT TO authenticated USING (customer_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_schedule' AND policyname = 'payment_schedule_super_admin') THEN
    CREATE POLICY payment_schedule_super_admin ON public.payment_schedule FOR ALL TO authenticated USING (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_schedule' AND policyname = 'payment_schedule_admin_read') THEN
    CREATE POLICY payment_schedule_admin_read ON public.payment_schedule FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND public.has_village_access(village_id))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_schedule' AND policyname = 'payment_schedule_accounting_all') THEN
    CREATE POLICY payment_schedule_accounting_all ON public.payment_schedule FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND public.has_village_role(village_id, 'accounting'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_schedule' AND policyname = 'payment_schedule_customer_read') THEN
    CREATE POLICY payment_schedule_customer_read ON public.payment_schedule FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.payment_plans WHERE id = payment_plan_id AND customer_id = auth.uid())
    );
  END IF;
END $$;
