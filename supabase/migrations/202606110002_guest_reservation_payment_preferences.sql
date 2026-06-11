ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS amount_due_today NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5, 2);

UPDATE public.reservations
SET amount_due_today = COALESCE(amount_due_today, initial_amount_due, reservation_fee)
WHERE amount_due_today IS NULL;
