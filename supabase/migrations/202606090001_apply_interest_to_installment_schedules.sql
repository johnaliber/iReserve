-- Backfill installment plans created before interest was included in monthly dues.
-- Plans with an already verified monthly installment are intentionally excluded
-- so historical customer ledgers are never repriced after repayment has started.

WITH eligible_plans AS (
  SELECT
    plan.id,
    plan.reservation_id,
    plan.initial_amount_due,
    plan.principal_balance,
    plan.installment_term_months,
    plan.interest_rate,
    ROUND(
      CASE
        WHEN COALESCE(plan.interest_rate, 0) = 0
          THEN plan.principal_balance / plan.installment_term_months
        ELSE
          plan.principal_balance
          * (
            (plan.interest_rate / 100 / 12)
            * POWER(1 + (plan.interest_rate / 100 / 12), plan.installment_term_months)
          )
          / (
            POWER(1 + (plan.interest_rate / 100 / 12), plan.installment_term_months) - 1
          )
      END,
      2
    ) AS monthly_payment,
    COALESCE((
      SELECT SUM(payment.amount)
      FROM public.payments payment
      WHERE payment.payment_plan_id = plan.id
        AND payment.payment_status = 'verified'
    ), 0) AS verified_amount
  FROM public.payment_plans plan
  WHERE plan.payment_type = 'installment'
    AND COALESCE(plan.interest_rate, 0) > 0
    AND plan.installment_term_months > 0
    AND plan.principal_balance > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments payment
      WHERE payment.payment_plan_id = plan.id
        AND payment.payment_purpose = 'monthly_installment'
        AND payment.payment_status = 'verified'
    )
),
updated_plans AS (
  UPDATE public.payment_plans plan
  SET
    monthly_payment = eligible.monthly_payment,
    remaining_balance = GREATEST(
      0,
      eligible.initial_amount_due
        + (eligible.monthly_payment * eligible.installment_term_months)
        - eligible.verified_amount
    ),
    total_payment_progress = LEAST(
      100,
      ROUND(
        eligible.verified_amount
        / NULLIF(
          eligible.initial_amount_due
            + (eligible.monthly_payment * eligible.installment_term_months),
          0
        )
        * 100,
        2
      )
    ),
    updated_at = NOW()
  FROM eligible_plans eligible
  WHERE plan.id = eligible.id
  RETURNING
    plan.id,
    plan.reservation_id,
    plan.monthly_payment,
    plan.remaining_balance,
    plan.total_payment_progress
),
updated_schedules AS (
  UPDATE public.payment_schedule schedule
  SET
    amount_due = updated.monthly_payment,
    remaining_due = updated.monthly_payment,
    updated_at = NOW()
  FROM updated_plans updated
  WHERE schedule.payment_plan_id = updated.id
    AND COALESCE(schedule.amount_paid, 0) = 0
    AND schedule.status IN ('unpaid', 'overdue')
  RETURNING schedule.payment_plan_id
)
UPDATE public.reservations reservation
SET
  monthly_payment = updated.monthly_payment,
  remaining_balance = updated.remaining_balance,
  updated_at = NOW()
FROM updated_plans updated
WHERE reservation.id = updated.reservation_id;
