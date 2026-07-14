import { getSupabaseServerClient } from "./supabase-server";
import {
  REPORTING_WINDOW_START,
  REPORTING_WINDOW_END,
  TARGET_MONTHS,
  monthEndDate,
} from "./reporting-window";

export type StoreOption = {
  store_id: number;
  type: string | null;
  size: number | null;
  region_name: string | null;
};

export type WeeklyActualRow = {
  week_date: string;
  actual_sales: number;
  is_holiday: boolean;
};

/** All 45 stores, for the Store picker. */
export async function getStores(): Promise<StoreOption[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("stores")
    .select("store_id, type, size, region_name")
    .order("store_id", { ascending: true });

  if (error) throw new Error(`Failed to load stores: ${error.message}`);
  return (data ?? []) as unknown as StoreOption[];
}

/**
 * Departments that actually have sales history for this store within the
 * May-Oct 2012 reporting window (not every dept exists at every store --
 * the Kaggle dataset is sparse).
 */
export async function getDeptsForStore(storeId: number): Promise<number[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_actuals")
    .select("dept_id")
    .eq("store_id", storeId)
    .gte("week_date", REPORTING_WINDOW_START)
    .lte("week_date", REPORTING_WINDOW_END);

  if (error) throw new Error(`Failed to load departments: ${error.message}`);

  const rows = (data ?? []) as unknown as { dept_id: number }[];
  const unique = Array.from(new Set(rows.map((r) => r.dept_id))).sort(
    (a, b) => a - b
  );
  return unique;
}

/**
 * Which of the 6 reporting-window months actually have a precomputed
 * forecast (sales_forecasts) for this store/dept -- a fallback-only combo
 * with no forecast row yet shouldn't be offered as a target month.
 */
export async function getAvailableMonths(
  storeId: number,
  deptId: number
): Promise<{ value: string; label: string }[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_forecasts")
    .select("week_date")
    .eq("store_id", storeId)
    .eq("dept_id", deptId)
    .gte("week_date", REPORTING_WINDOW_START)
    .lte("week_date", REPORTING_WINDOW_END);

  if (error) throw new Error(`Failed to load available months: ${error.message}`);

  const rows = (data ?? []) as unknown as { week_date: string }[];
  const monthsWithData = new Set(rows.map((r) => r.week_date.slice(0, 7))); // "YYYY-MM"

  return TARGET_MONTHS.filter((m) => monthsWithData.has(m.value.slice(0, 7)));
}

/**
 * Pre-fills the editable weekly actuals grid for the chosen store/dept/month.
 */
export async function getWeeklyActuals(
  storeId: number,
  deptId: number,
  targetMonthIso: string
): Promise<WeeklyActualRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_actuals")
    .select("week_date, actual_sales, is_holiday")
    .eq("store_id", storeId)
    .eq("dept_id", deptId)
    .gte("week_date", targetMonthIso)
    .lte("week_date", monthEndDate(targetMonthIso))
    .order("week_date", { ascending: true });

  if (error) throw new Error(`Failed to load weekly actuals: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    week_date: string;
    actual_sales: number | string;
    is_holiday: boolean | null;
  }[];

  return rows.map((r) => ({
    week_date: r.week_date,
    actual_sales: Number(r.actual_sales),
    is_holiday: Boolean(r.is_holiday),
  }));
}
