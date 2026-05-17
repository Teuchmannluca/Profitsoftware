-- Business settings: single-row table for VAT registration and business config

CREATE TABLE business_settings (
  id                          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vat_status                  text DEFAULT 'standard',
  vat_rate                    numeric DEFAULT 0.20,
  vat_registration_number     text,
  vat_registration_date       date,
  amazon_vat_activation_date  date,
  vat_deregistration_date     date,
  flat_rate_percentage        numeric,
  exemption_period_start      date,
  exemption_period_end        date,
  business_name               text,
  business_email              text,
  updated_at                  timestamptz DEFAULT now()
);

INSERT INTO business_settings (id) VALUES (1);
