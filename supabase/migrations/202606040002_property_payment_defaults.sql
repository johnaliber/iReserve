ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS downpayment_percentage NUMERIC(5, 2) DEFAULT 20,
ADD COLUMN IF NOT EXISTS default_loan_term_years INT DEFAULT 15;

ALTER TABLE public.property_type_presets
ADD COLUMN IF NOT EXISTS downpayment_percentage NUMERIC(5, 2) NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS default_loan_term_years INT NOT NULL DEFAULT 15;
