-- Treat the reservation fee as part of the required downpayment instead of an
-- additional charge. Plans with verified monthly installments are excluded so
-- active repayment histories are not repriced.

WITH eligible_base AS (
  SELECT
    plan.id,
    plan.reservation_id,
    plan.total_contract_price,
    plan.reservation_fee,
    plan.downpayment_amount AS required_downpayment,
    plan.installment_term_months,
    plan.interest_rate,
    GREATEST(plan.downpayment_amount, plan.reservation_fee) AS corrected_initial_payment,
    GREATEST(
      0,
      plan.total_contract_price - GREATEST(plan.downpayment_amount, plan.reservation_fee)
    ) AS corrected_principal,
    COALESCE((
      SELECT SUM(payment.amount)
      FROM public.payments payment
      WHERE payment.payment_plan_id = plan.id
        AND payment.payment_status = 'verified'
    ), 0) AS verified_amount
  FROM public.payment_plans plan
  WHERE plan.payment_type IN ('partial_payment', 'installment')
    AND plan.installment_term_months > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments payment
      WHERE payment.payment_plan_id = plan.id
        AND payment.payment_purpose = 'monthly_installment'
        AND payment.payment_status = 'verified'
    )
),
eligible_plans AS (
  SELECT
    base.*,
    ROUND(
      CASE
        WHEN base.payment_type = 'partial_payment'
          THEN base.corrected_principal / base.installment_term_months
        WHEN COALESCE(base.interest_rate, 0) = 0
          THEN base.corrected_principal / base.installment_term_months
        ELSE
          base.corrected_principal
          * (
            (base.interest_rate / 100 / 12)
            * POWER(1 + (base.interest_rate / 100 / 12), base.installment_term_months)
          )
          / (
            POWER(1 + (base.interest_rate / 100 / 12), base.installment_term_months) - 1
          )
      END,
      2
    ) AS corrected_monthly_payment
    ,
    ROUND(
      CASE
        WHEN base.payment_type = 'partial_payment'
          THEN base.corrected_principal
        WHEN COALESCE(base.interest_rate, 0) = 0
          THEN base.corrected_principal
        ELSE
          (
            base.corrected_principal
            * (
              (base.interest_rate / 100 / 12)
              * POWER(1 + (base.interest_rate / 100 / 12), base.installment_term_months)
            )
            / (
              POWER(1 + (base.interest_rate / 100 / 12), base.installment_term_months) - 1
            )
          ) * base.installment_term_months
      END,
      2
    ) AS corrected_installment_total
  FROM (
    SELECT
      eligible_base.*,
      plan.payment_type
    FROM eligible_base
    JOIN public.payment_plans plan ON plan.id = eligible_base.id
  ) base
),
priced_plans AS (
  SELECT
    eligible.*,
    CASE
      WHEN eligible.payment_type = 'installment'
        THEN eligible.corrected_initial_payment
          + eligible.corrected_installment_total
      ELSE eligible.total_contract_price
    END AS corrected_total_payment
  FROM eligible_plans eligible
),
updated_plans AS (
  UPDATE public.payment_plans plan
  SET
    initial_amount_due = priced.corrected_initial_payment,
    principal_balance = priced.corrected_principal,
    monthly_payment = priced.corrected_monthly_payment,
    remaining_balance = GREATEST(0, priced.corrected_total_payment - priced.verified_amount),
    initial_payment_progress = LEAST(
      100,
      ROUND(
        priced.verified_amount
          / NULLIF(priced.corrected_initial_payment, 0)
          * 100,
        2
      )
    ),
    total_payment_progress = LEAST(
      100,
      ROUND(
        priced.verified_amount
          / NULLIF(priced.corrected_total_payment, 0)
          * 100,
        2
      )
    ),
    updated_at = NOW()
  FROM priced_plans priced
  WHERE plan.id = priced.id
  RETURNING
    plan.id,
    plan.reservation_id,
    plan.initial_amount_due,
    plan.principal_balance,
    plan.monthly_payment,
    plan.remaining_balance
),
updated_schedules AS (
  UPDATE public.payment_schedule schedule
  SET
    amount_due = CASE
      WHEN schedule.due_number = plan.installment_term_months
        THEN ROUND(
          priced.corrected_installment_total
            - (priced.corrected_monthly_payment * (plan.installment_term_months - 1)),
          2
        )
      ELSE updated.monthly_payment
    END,
    remaining_due = CASE
      WHEN schedule.due_number = plan.installment_term_months
        THEN ROUND(
          priced.corrected_installment_total
            - (priced.corrected_monthly_payment * (plan.installment_term_months - 1)),
          2
        )
      ELSE updated.monthly_payment
    END,
    updated_at = NOW()
  FROM updated_plans updated
  JOIN public.payment_plans plan ON plan.id = updated.id
  JOIN priced_plans priced ON priced.id = updated.id
  WHERE schedule.payment_plan_id = updated.id
    AND COALESCE(schedule.amount_paid, 0) = 0
    AND schedule.status IN ('unpaid', 'overdue')
  RETURNING schedule.payment_plan_id
),
updated_pending_payments AS (
  UPDATE public.payments payment
  SET
    amount = updated.initial_amount_due,
    maximum_payable_amount = updated.initial_amount_due,
    submitted_amount = updated.initial_amount_due,
    accepted_amount = updated.initial_amount_due,
    updated_at = NOW()
  FROM updated_plans updated
  WHERE payment.payment_plan_id = updated.id
    AND payment.payment_purpose = 'downpayment'
    AND payment.payment_status = 'pending_verification'
    AND payment.payment_schedule_id IS NULL
  RETURNING payment.payment_plan_id
)
UPDATE public.reservations reservation
SET
  initial_amount_due = updated.initial_amount_due,
  monthly_payment = updated.monthly_payment,
  remaining_balance = updated.remaining_balance,
  updated_at = NOW()
FROM updated_plans updated
WHERE reservation.id = updated.reservation_id;
