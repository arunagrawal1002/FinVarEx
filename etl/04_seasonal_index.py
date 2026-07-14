"""
Stage 2 / Step 4: Build seasonal_index (v3 Section 7).

seasonal_index[dept][iso_week] = avg(actual_sales for that dept, that
iso_week, across all stores/years) / avg(actual_sales for that dept, across
all iso_weeks)

Reads directly from the DB (sales_actuals must already be loaded --
run 02_load_sales_actuals.py first).

Idempotent: safe to re-run (ON CONFLICT DO UPDATE on dept_id, iso_week).
"""
import pandas as pd
from psycopg2.extras import execute_values
from db import get_connection


def main():
    conn = get_connection()
    try:
        sales = pd.read_sql(
            "SELECT dept_id, week_date, actual_sales FROM sales_actuals", conn
        )
        sales["week_date"] = pd.to_datetime(sales["week_date"])
        sales["iso_week"] = sales["week_date"].dt.isocalendar().week.astype(int)

        dept_week_avg = sales.groupby(["dept_id", "iso_week"])["actual_sales"].mean()
        dept_avg = sales.groupby("dept_id")["actual_sales"].mean()

        rows = []
        for (dept_id, iso_week), week_avg in dept_week_avg.items():
            overall_avg = dept_avg[dept_id]
            if overall_avg and overall_avg != 0:
                idx = week_avg / overall_avg
                rows.append((int(dept_id), int(iso_week), round(float(idx), 3)))

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO seasonal_index (dept_id, iso_week, seasonal_index)
                VALUES %s
                ON CONFLICT (dept_id, iso_week) DO UPDATE SET seasonal_index = EXCLUDED.seasonal_index
                """,
                rows,
            )
        conn.commit()
        print(f"seasonal_index: upserted {len(rows)} rows")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
