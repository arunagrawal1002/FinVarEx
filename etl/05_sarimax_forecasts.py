"""
Stage 2 / Step 5: Fit SARIMAX(1,1,1)+holiday-exog per (store, dept), forecast
the May-Oct 2012 reporting window, and seed sales_forecasts (v3 Section 5).

- One fit per (store, dept) with >= 52 weeks of history strictly before the
  2012-05-01 cutoff (no lookahead -- fit_cutoff_date is stored per row so
  this is auditable, not just asserted).
- Fixed order (1,1,1), not a per-series auto_arima search -- deliberate,
  since ~2.5 years of weekly data can't reliably support a full 52-week
  seasonal ARIMA (would want 3+ seasonal cycles).
- Fallback to a trailing 4-week rolling average for: (a) series with < 52
  weeks of pre-cutoff history, or (b) any series where the SARIMAX fit
  fails to converge / raises -- a thin baseline or a numerically unstable
  fit are both data-quality conditions, not something to paper over.
  model_type is flagged accordingly either way.

Idempotent: safe to re-run (ON CONFLICT DO NOTHING on store_id, dept_id, week_date).
Reads from and writes to the DB directly -- run 02_load_sales_actuals.py first.
"""
import warnings
import pandas as pd
import numpy as np
from psycopg2.extras import execute_values
from db import get_connection

warnings.filterwarnings("ignore")

CUTOFF = pd.Timestamp("2012-05-01")
WINDOW_END = pd.Timestamp("2012-10-26")
MIN_HISTORY_WEEKS = 52


def fit_one_series(hist: pd.DataFrame, forecast_dates: pd.DatetimeIndex):
    """Returns (forecast_values, model_type). Never raises."""
    if len(hist) < MIN_HISTORY_WEEKS:
        return rolling_avg_fallback(hist, forecast_dates), "rolling_avg_fallback"

    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        y = hist.set_index("week_date")["actual_sales"].asfreq("W-FRI")
        y = y.interpolate()
        exog = hist.set_index("week_date")["is_holiday"].astype(int).asfreq("W-FRI").fillna(0)

        model = SARIMAX(y, exog=exog, order=(1, 1, 1),
                         enforce_stationarity=False, enforce_invertibility=False)
        fitted = model.fit(disp=False)

        future_exog = pd.DataFrame(
            {"is_holiday": 0}, index=forecast_dates
        )  # holiday flag unknown at forecast time; conservative default
        pred = fitted.forecast(steps=len(forecast_dates), exog=future_exog)
        values = pred.values
        if np.any(np.isnan(values)) or np.any(np.isinf(values)):
            raise ValueError("non-finite forecast")
        return values, "SARIMAX(1,1,1)+holiday_exog"
    except Exception:
        # Convergence failure or any numerical issue -> documented fallback,
        # not a silent crash. A thin/unstable fit is a data-quality
        # condition, not a business cause of variance.
        return rolling_avg_fallback(hist, forecast_dates), "rolling_avg_fallback"


def rolling_avg_fallback(hist: pd.DataFrame, forecast_dates: pd.DatetimeIndex):
    trailing = hist.sort_values("week_date")["actual_sales"].tail(4).mean()
    if pd.isna(trailing):
        trailing = hist["actual_sales"].mean() if len(hist) else 0.0
    return np.full(len(forecast_dates), trailing)


def main():
    conn = get_connection()
    try:
        sales = pd.read_sql(
            "SELECT store_id, dept_id, week_date, actual_sales, is_holiday FROM sales_actuals",
            conn,
        )
        sales["week_date"] = pd.to_datetime(sales["week_date"])

        forecast_dates = pd.date_range("2012-05-04", WINDOW_END, freq="W-FRI")

        combos = sales[["store_id", "dept_id"]].drop_duplicates()
        rows = []
        n_sarimax, n_fallback = 0, 0

        for combo in combos.itertuples(index=False):
            store_id, dept_id = int(combo.store_id), int(combo.dept_id)
            series = sales[
                (sales.store_id == store_id) & (sales.dept_id == dept_id)
            ]
            hist = series[series.week_date < CUTOFF]
            if hist.empty:
                continue

            values, model_type = fit_one_series(hist, forecast_dates)
            if model_type.startswith("SARIMAX"):
                n_sarimax += 1
            else:
                n_fallback += 1

            for d, v in zip(forecast_dates, values):
                rows.append((
                    store_id, dept_id, d.strftime("%Y-%m-%d"),
                    round(float(v), 2), model_type, CUTOFF.strftime("%Y-%m-%d"),
                ))

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO sales_forecasts
                    (store_id, dept_id, week_date, forecast_sales, model_type, fit_cutoff_date)
                VALUES %s
                ON CONFLICT (store_id, dept_id, week_date) DO NOTHING
                """,
                rows,
                page_size=5000,
            )
        conn.commit()
        print(f"sales_forecasts: upserted {len(rows)} rows "
              f"({n_sarimax} SARIMAX fits, {n_fallback} rolling-avg fallbacks)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
