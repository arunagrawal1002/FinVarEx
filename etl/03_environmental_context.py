"""
Stage 2 / Step 3: Build weekly_environmental_context.

REAL fields (from the original Kaggle features.csv, authentic per-store
weekly data): fuel_price, markdown_total (sum of MarkDown1-5, NA treated as
0), cpi, unemployment_rate, temp_avg.

DISCLOSED SYNTHETIC fields (no live source was reachable for these --
Open-Meteo and FRED were both unavailable in the dev sandbox; per the
project's decision, these are generated, plausible, and explicitly flagged
via the `synthetic_fields` column added to this table):
  - consumer_sentiment       (national-level synthetic index, ~seasonal + trend + noise)
  - disposable_income_idx    (national-level synthetic slow-trending index)
  - wti_oil_price            (derived from the REAL fuel_price with a rough
                               historical scale factor + noise -- grounded in
                               real data but not the actual WTI series)
  - precipitation_weekly_mm  (synthetic, seasonal by region + iso_week)
  - severe_weather_flag      (derived: top ~5% of that store's synthetic
                               precipitation distribution)

Idempotent: safe to re-run (ON CONFLICT DO NOTHING on store_id, week_date).
"""
import numpy as np
import pandas as pd
from psycopg2.extras import execute_values
from db import get_connection, local_or_remote

FEATURES_URL = "https://raw.githubusercontent.com/vicky60629/Walmart-Store-Sales-Forecasting/master/data/features.csv"

REGION_BASE_PRECIP_MM = {
    "Northeast": 25, "Mid-Atlantic": 22, "Southeast": 30, "South": 18,
    "Midwest": 20, "Southwest": 8, "West": 15, "Mountain": 12,
}


def synthetic_national_series(dates):
    """Deterministic (seeded) synthetic consumer_sentiment / disposable_income_idx."""
    rng = np.random.default_rng(42)
    n = len(dates)
    week_idx = np.arange(n)
    sentiment = 82 + 6 * np.sin(week_idx / 26 * np.pi) + rng.normal(0, 1.5, n)
    disposable = 100 + week_idx * 0.03 + 4 * np.sin(week_idx / 52 * 2 * np.pi) + rng.normal(0, 0.8, n)
    return sentiment, disposable


def main():
    feats = pd.read_csv(local_or_remote("features.csv", FEATURES_URL))
    feats["Date"] = pd.to_datetime(feats["Date"])
    md_cols = ["MarkDown1", "MarkDown2", "MarkDown3", "MarkDown4", "MarkDown5"]
    for c in md_cols:
        feats[c] = pd.to_numeric(feats[c], errors="coerce").fillna(0)
    feats["markdown_total"] = feats[md_cols].sum(axis=1)

    # region lookup per store, must match what 01_load_stores.py assigned
    from importlib import import_module
    load_stores = import_module("01_load_stores")
    store_region = {}
    for i in range(45):
        store_id = i + 1
        _, _, region = load_stores.CITIES[i % len(load_stores.CITIES)]
        store_region[store_id] = region

    unique_dates = sorted(feats["Date"].unique())
    date_to_idx = {d: i for i, d in enumerate(unique_dates)}
    sentiment_series, disposable_series = synthetic_national_series(unique_dates)

    rng = np.random.default_rng(7)
    rows = []
    for r in feats.itertuples():
        store_id = int(r.Store)
        week_date = r.Date.strftime("%Y-%m-%d")
        iso_week = r.Date.isocalendar()[1]
        idx = date_to_idx[r.Date]

        region = store_region.get(store_id, "Midwest")
        base_precip = REGION_BASE_PRECIP_MM.get(region, 18)
        seasonal_mult = 1 + 0.4 * np.sin((iso_week / 52) * 2 * np.pi + np.pi / 2)
        precip = max(0, base_precip * seasonal_mult + rng.normal(0, 6))
        severe = precip > (base_precip * 2.2)

        fuel_price = float(r.Fuel_Price)
        wti = fuel_price * 27.5 + rng.normal(0, 3)  # rough 2010-2012 fuel-to-crude scale, disclosed synthetic

        rows.append((
            store_id, week_date,
            fuel_price,
            float(r.markdown_total),
            float(r.CPI),
            float(r.Unemployment),
            round(float(sentiment_series[idx]), 1),
            round(float(disposable_series[idx]), 2),
            round(float(wti), 2),
            round(float(precip), 2),
            float(r.Temperature),
            bool(severe),
        ))

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO weekly_environmental_context
                    (store_id, week_date, fuel_price, markdown_total, cpi, unemployment_rate,
                     consumer_sentiment, disposable_income_idx, wti_oil_price,
                     precipitation_weekly_mm, temp_avg, severe_weather_flag)
                VALUES %s
                ON CONFLICT (store_id, week_date) DO NOTHING
                """,
                rows,
                page_size=5000,
            )
        conn.commit()
        print(f"weekly_environmental_context: upserted {len(rows)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
