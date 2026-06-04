UPDATE public.properties AS property
SET
  interest_rate = preset.interest_rate,
  downpayment_percentage = preset.downpayment_percentage,
  default_loan_term_years = preset.default_loan_term_years,
  model_name = COALESCE(NULLIF(property.model_name, ''), NULLIF(preset.model_name, ''), preset.name),
  updated_at = TIMEZONE('utc'::text, NOW())
FROM public.property_type_presets AS preset
WHERE
  preset.is_active = TRUE
  AND property.village_id = preset.village_id
  AND COALESCE(property.interest_rate, 0) = 0
  AND property.property_type = preset.property_type
  AND property.price = preset.price
  AND property.reservation_fee = preset.reservation_fee
  AND property.lot_size = preset.lot_size
  AND COALESCE(property.floor_area, 0) = COALESCE(preset.floor_area, 0)
  AND COALESCE(property.bedrooms, 0) = COALESCE(preset.bedrooms, 0)
  AND COALESCE(property.bathrooms, 0) = COALESCE(preset.bathrooms, 0)
  AND COALESCE(property.parking_slots, 0) = COALESCE(preset.parking_slots, 0);
