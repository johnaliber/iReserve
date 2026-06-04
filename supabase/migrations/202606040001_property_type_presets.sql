ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.property_type_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    property_type TEXT NOT NULL CHECK (property_type IN ('lot', 'house_and_lot', 'townhouse', 'duplex', 'commercial_lot')),
    model_name TEXT,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reservation_fee NUMERIC(15, 2) NOT NULL DEFAULT 5000,
    interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    lot_size NUMERIC(10, 2) NOT NULL DEFAULT 0,
    floor_area NUMERIC(10, 2),
    bedrooms INT DEFAULT 0,
    bathrooms INT DEFAULT 0,
    parking_slots INT DEFAULT 0,
    orientation TEXT,
    flood_risk TEXT NOT NULL DEFAULT 'low' CHECK (flood_risk IN ('low', 'medium', 'high')),
    sunlight_exposure TEXT NOT NULL DEFAULT 'balanced' CHECK (sunlight_exposure IN ('morning', 'afternoon', 'balanced', 'limited')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(village_id, name)
);

ALTER TABLE public.property_type_presets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_type_presets' AND policyname = 'property_type_presets_super_admin') THEN
    CREATE POLICY property_type_presets_super_admin ON public.property_type_presets FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_type_presets' AND policyname = 'property_type_presets_admin_all') THEN
    CREATE POLICY property_type_presets_admin_all ON public.property_type_presets FOR ALL TO authenticated
    USING (public.has_village_role(village_id, 'village_admin'))
    WITH CHECK (public.has_village_role(village_id, 'village_admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_type_presets' AND policyname = 'property_type_presets_read_staff') THEN
    CREATE POLICY property_type_presets_read_staff ON public.property_type_presets FOR SELECT TO authenticated
    USING (public.has_village_access(village_id));
  END IF;
END $$;
