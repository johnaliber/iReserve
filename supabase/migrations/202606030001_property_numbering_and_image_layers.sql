ALTER TABLE public.villages
ADD COLUMN IF NOT EXISTS village_code TEXT;

UPDATE public.villages
SET village_code = UPPER(REGEXP_REPLACE(
  CASE
    WHEN ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(TRIM(name), '\s+'), 1) > 1 THEN
      ARRAY_TO_STRING(ARRAY(
        SELECT SUBSTRING(word FROM 1 FOR 1)
        FROM UNNEST(REGEXP_SPLIT_TO_ARRAY(TRIM(name), '\s+')) AS word
      ), '')
    ELSE SUBSTRING(TRIM(name) FROM 1 FOR 3)
  END,
  '[^A-Za-z0-9-]',
  '',
  'g'
))
WHERE village_code IS NULL OR village_code = '';

ALTER TABLE public.villages
ALTER COLUMN village_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS villages_village_code_key
ON public.villages (village_code);

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS village_code TEXT,
ADD COLUMN IF NOT EXISTS phase_number TEXT NOT NULL DEFAULT '1';

UPDATE public.properties p
SET village_code = v.village_code
FROM public.villages v
WHERE p.village_id = v.id
  AND (p.village_code IS NULL OR p.village_code = '');

ALTER TABLE public.properties
DROP CONSTRAINT IF EXISTS properties_village_id_block_number_lot_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS properties_property_code_key
ON public.properties (property_code);

CREATE UNIQUE INDEX IF NOT EXISTS properties_village_phase_block_lot_key
ON public.properties (village_id, phase_number, block_number, lot_number);

ALTER TABLE public.blueprint_objects
DROP CONSTRAINT IF EXISTS blueprint_objects_object_type_check;

ALTER TABLE public.blueprint_objects
ADD CONSTRAINT blueprint_objects_object_type_check
CHECK (object_type IN (
  'road',
  'lot',
  'house',
  'tree',
  'amenity',
  'label',
  'zone',
  'gate',
  'guard_house',
  'clubhouse',
  'pool',
  'park',
  'street_light',
  'landmark',
  'sidewalk',
  'image_layer'
));

INSERT INTO storage.buckets (id, name, public)
VALUES ('blueprint-assets', 'blueprint-assets', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Blueprint assets are publicly readable" ON storage.objects;
CREATE POLICY "Blueprint assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'blueprint-assets');

DROP POLICY IF EXISTS "Authenticated users can upload blueprint assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload blueprint assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blueprint-assets');

DROP POLICY IF EXISTS "Authenticated users can update blueprint assets" ON storage.objects;
CREATE POLICY "Authenticated users can update blueprint assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'blueprint-assets')
WITH CHECK (bucket_id = 'blueprint-assets');
