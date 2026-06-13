ALTER TABLE public.property_type_presets
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS floor_plan_url TEXT;
