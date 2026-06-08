CREATE OR REPLACE FUNCTION public.claim_guest_reservations_for_user(
    p_user_id UUID,
    p_email TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claimed_ids UUID[];
BEGIN
    IF p_user_id IS NULL OR NULLIF(BTRIM(p_email), '') IS NULL THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_user_id
          AND role = 'customer'
    ) THEN
        RETURN 0;
    END IF;

    SELECT ARRAY_AGG(id)
    INTO claimed_ids
    FROM public.reservations
    WHERE customer_id IS NULL
      AND LOWER(BTRIM(guest_email)) = LOWER(BTRIM(p_email));

    IF COALESCE(CARDINALITY(claimed_ids), 0) = 0 THEN
        RETURN 0;
    END IF;

    UPDATE public.reservations
    SET customer_id = p_user_id,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = ANY(claimed_ids)
      AND customer_id IS NULL;

    UPDATE public.payment_plans
    SET customer_id = p_user_id,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE reservation_id = ANY(claimed_ids)
      AND customer_id IS NULL;

    UPDATE public.payments
    SET customer_id = p_user_id,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE reservation_id = ANY(claimed_ids)
      AND customer_id IS NULL;

    UPDATE public.documents
    SET customer_id = p_user_id
    WHERE reservation_id = ANY(claimed_ids)
      AND customer_id IS NULL;

    UPDATE public.site_viewings
    SET customer_id = p_user_id,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE reservation_id = ANY(claimed_ids)
      AND customer_id IS NULL;

    RETURN CARDINALITY(claimed_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_reservations_for_user(UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Valued Customer'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url;

  PERFORM public.claim_guest_reservations_for_user(new.id, new.email);
  RETURN NEW;
END;
$$;
