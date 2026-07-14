"""
Stage 2 / Step 2: Load the FULL real train.csv (all ~421,570 rows, all 45
stores x all departments) into sales_actuals.

This is the authentic Walmart Recruiting - Store Sales Forecasting Kaggle
competition dataset (Store, Dept, Date, Weekly_Sales, IsHoliday), sourced via
a public GitHub mirror since Kaggle itself requires an authenticated login.

Idempotent: safe to re-run (ON CONFLICT DO NOTHING on store_id, dept_id, week_date).
Uses execute_values with page_size batching for fast bulk insert.
"""
import pandas as pd
from psycopg2.extras import execute_values
from db import get_connection, local_or_remote

TRAIN_URL = "https://raw.githubusercontent.com/vicky60629/Walmart-Store-Sales-Forecasting/master/data/train.csv"


def main():
    train = pd.read_csv(local_or_remote("train.csv", TRAIN_URL))
    train["Date"] = pd.to_datetime(train["Date"]).dt.strftime("%Y-%m-%d")

    rows = [
        (int(r.Store), int(r.Dept), r.Date, float(r.Weekly_Sales), bool(r.IsHoliday))
        for r in train.itertuples()
    ]

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO sales_actuals (store_id, dept_id, week_date, actual_sales, is_holiday)
                VALUES %s
                ON CONFLICT (store_id, dept_id, week_date) DO NOTHING
                """,
                rows,
                page_size=5000,
            )
        conn.commit()
        print(f"sales_actuals: upserted {len(rows)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
