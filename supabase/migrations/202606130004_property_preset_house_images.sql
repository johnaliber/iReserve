ALTER TABLE public.property_type_presets
ADD COLUMN IF NOT EXISTS house_images JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.property_type_presets
SET house_images = jsonb_build_array(thumbnail_url)
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url <> ''
  AND house_images = '[]'::jsonb;
