CREATE OR REPLACE FUNCTION public.sync_property_status_from_reservations(
    p_property_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_status TEXT;
    resolved_status TEXT;
BEGIN
    IF p_property_id IS NULL THEN
        RETURN;
    END IF;

    SELECT status
    INTO current_status
    FROM public.properties
    WHERE id = p_property_id;

    IF current_status IS NULL OR current_status IN ('under_maintenance', 'hidden') THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE property_id = p_property_id
          AND status = 'converted_to_sale'
    ) THEN
        resolved_status := 'sold';
    ELSIF EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE property_id = p_property_id
          AND status IN (
              'pending_payment',
              'pending_documents',
              'pending_verification',
              'reserved',
              'approved'
          )
    ) THEN
        resolved_status := 'reserved';
    ELSE
        resolved_status := 'available';
    END IF;

    UPDATE public.properties
    SET status = resolved_status,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_property_id
      AND status IS DISTINCT FROM resolved_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_reservation_property_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.sync_property_status_from_reservations(OLD.property_id);
        RETURN OLD;
    END IF;

    PERFORM public.sync_property_status_from_reservations(NEW.property_id);

    IF TG_OP = 'UPDATE' AND OLD.property_id IS DISTINCT FROM NEW.property_id THEN
        PERFORM public.sync_property_status_from_reservations(OLD.property_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_property_status_after_reservation_change ON public.reservations;
CREATE TRIGGER sync_property_status_after_reservation_change
AFTER INSERT OR UPDATE OF status, property_id OR DELETE
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.handle_reservation_property_status();

DO $$
DECLARE
    property_row RECORD;
BEGIN
    FOR property_row IN SELECT id FROM public.properties LOOP
        PERFORM public.sync_property_status_from_reservations(property_row.id);
    END LOOP;
END;
$$;
