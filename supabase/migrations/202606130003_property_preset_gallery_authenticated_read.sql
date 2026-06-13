DROP POLICY IF EXISTS property_type_presets_public_gallery ON public.property_type_presets;
CREATE POLICY property_type_presets_public_gallery
ON public.property_type_presets
FOR SELECT
TO anon, authenticated
USING (is_active = TRUE AND show_in_public_gallery = TRUE);
