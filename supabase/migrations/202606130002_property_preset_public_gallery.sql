ALTER TABLE public.property_type_presets
ADD COLUMN IF NOT EXISTS show_in_public_gallery BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS gallery_order INT NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS property_type_presets_public_gallery ON public.property_type_presets;
CREATE POLICY property_type_presets_public_gallery
ON public.property_type_presets
FOR SELECT
TO anon
USING (is_active = TRUE AND show_in_public_gallery = TRUE);
