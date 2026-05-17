-- COGS periods: time-versioned cost per ASIN

CREATE TABLE cogs_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin        text NOT NULL,
  valid_from  date NOT NULL,
  valid_to    date,
  unit_cost   numeric NOT NULL,
  prep_cost   numeric DEFAULT 0,
  total_cogs  numeric GENERATED ALWAYS AS (unit_cost + prep_cost) STORED,
  currency    text DEFAULT 'GBP',
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_cogs_asin ON cogs_periods(asin, valid_from DESC);

-- Auto-close previous active period when inserting a new one
CREATE OR REPLACE FUNCTION close_previous_cogs_period()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cogs_periods
  SET valid_to = NEW.valid_from - INTERVAL '1 day'
  WHERE asin = NEW.asin
    AND id != NEW.id
    AND valid_to IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_close_previous_cogs
AFTER INSERT ON cogs_periods
FOR EACH ROW
EXECUTE FUNCTION close_previous_cogs_period();
