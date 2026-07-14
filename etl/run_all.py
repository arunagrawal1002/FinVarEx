"""Runs the full Stage 2 ETL pipeline in order. See README.md for setup."""
import importlib
import time

STEPS = [
    "01_load_stores",
    "02_load_sales_actuals",
    "03_environmental_context",
    "04_seasonal_index",
    "05_sarimax_forecasts",
    "06_competitor_intelligence",
]

if __name__ == "__main__":
    for step in STEPS:
        print(f"\n=== {step} ===")
        t0 = time.time()
        mod = importlib.import_module(step)
        mod.main()
        print(f"({time.time() - t0:.1f}s)")
    print("\nDone. Run the row-count check in README.md to confirm.")
