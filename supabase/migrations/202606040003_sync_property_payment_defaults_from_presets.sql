UPDATE public.properties AS property
SET
  interest_rate = preset.interest_rate,
  downpayment_percentage = preset.downpayment_percentage,
  default_loan_term_years = preset.default_loan_term_years,
  updated_at = TIMEZONE('utc'::text, NOW())
FROM public.property_type_presets AS preset
WHERE
  preset.is_active = TRUE
  AND property.village_id = preset.village_id
  AND LOWER(TRIM(property.model_name)) = LOWER(TRIM(COALESCE(NULLIF(preset.model_name, ''), preset.name)));
