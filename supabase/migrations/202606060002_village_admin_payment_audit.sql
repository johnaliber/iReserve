CREATE POLICY payment_plans_village_admin_all
    ON public.payment_plans
    FOR ALL
    TO authenticated
    USING (public.has_village_role(village_id, 'village_admin'))
    WITH CHECK (public.has_village_role(village_id, 'village_admin'));

CREATE POLICY payment_schedule_village_admin_all
    ON public.payment_schedule
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.payment_plans
            WHERE id = payment_plan_id
              AND public.has_village_role(village_id, 'village_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.payment_plans
            WHERE id = payment_plan_id
              AND public.has_village_role(village_id, 'village_admin')
        )
    );

CREATE POLICY payments_village_admin_all
    ON public.payments
    FOR ALL
    TO authenticated
    USING (public.has_village_role(village_id, 'village_admin'))
    WITH CHECK (public.has_village_role(village_id, 'village_admin'));

