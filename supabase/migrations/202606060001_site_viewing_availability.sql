CREATE TABLE IF NOT EXISTS public.site_viewing_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    available_date DATE NOT NULL,
    start_time TIME NOT NULL DEFAULT '08:00',
    end_time TIME NOT NULL DEFAULT '17:00',
    daily_capacity INT NOT NULL DEFAULT 8 CHECK (daily_capacity > 0),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (village_id, available_date),
    CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_site_viewing_availability_village_date
    ON public.site_viewing_availability(village_id, available_date);

ALTER TABLE public.site_viewing_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_viewing_availability_read_authenticated
    ON public.site_viewing_availability
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY site_viewing_availability_super_admin
    ON public.site_viewing_availability
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY site_viewing_availability_village_admin
    ON public.site_viewing_availability
    FOR ALL
    TO authenticated
    USING (public.has_village_role(village_id, 'village_admin'))
    WITH CHECK (public.has_village_role(village_id, 'village_admin'));

CREATE OR REPLACE FUNCTION public.validate_site_viewing_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    availability public.site_viewing_availability%ROWTYPE;
    active_bookings INT;
BEGIN
    SELECT *
    INTO availability
    FROM public.site_viewing_availability
    WHERE village_id = NEW.village_id
      AND available_date = NEW.preferred_date;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected date is not open for site viewing.';
    END IF;

    IF NEW.preferred_time < availability.start_time
       OR NEW.preferred_time >= availability.end_time THEN
        RAISE EXCEPTION 'The selected time is outside the available viewing hours.';
    END IF;

    SELECT COUNT(*)
    INTO active_bookings
    FROM public.site_viewings
    WHERE village_id = NEW.village_id
      AND preferred_date = NEW.preferred_date
      AND status IN ('pending', 'approved')
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF active_bookings >= availability.daily_capacity THEN
        RAISE EXCEPTION 'The selected site viewing date is already fully booked.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_site_viewing_availability_trigger ON public.site_viewings;
CREATE TRIGGER validate_site_viewing_availability_trigger
    BEFORE INSERT OR UPDATE OF village_id, preferred_date, preferred_time, status
    ON public.site_viewings
    FOR EACH ROW
    WHEN (NEW.status IN ('pending', 'approved'))
    EXECUTE FUNCTION public.validate_site_viewing_availability();
