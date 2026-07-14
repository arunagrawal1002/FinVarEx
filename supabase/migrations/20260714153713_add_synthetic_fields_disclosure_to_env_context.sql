-- Discloses which weekly_environmental_context columns are synthetic
-- (no live source was reachable for consumer_sentiment, disposable_income_idx,
-- wti_oil_price, precipitation_weekly_mm, severe_weather_flag -- Open-Meteo and
-- FRED were both unreachable from the dev environment). Real fields
-- (fuel_price, markdown_total, cpi, unemployment_rate, temp_avg) are
-- authentic Kaggle data and are not listed here.
ALTER TABLE weekly_environmental_context
  ADD COLUMN IF NOT EXISTS synthetic_fields TEXT[] DEFAULT ARRAY['consumer_sentiment','disposable_income_idx','wti_oil_price','precipitation_weekly_mm','severe_weather_flag']::TEXT[];
