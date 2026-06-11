DROP POLICY IF EXISTS blueprint_objects_village_admin_link_update
ON public.blueprint_objects;

CREATE POLICY blueprint_objects_village_admin_link_update
ON public.blueprint_objects
FOR UPDATE
TO authenticated
USING (public.has_village_role(village_id, 'village_admin'))
WITH CHECK (public.has_village_role(village_id, 'village_admin'));
