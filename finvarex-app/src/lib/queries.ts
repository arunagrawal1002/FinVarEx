import { getSupabaseServerClient } from "./supabase-server";
import {
  REPORTING_WINDOW_START,
  REPORTING_WINDOW_END,
  TARGET_MONTHS,
  monthEndDate,
} from "./reporting-window";
import type { Classification, MathematicalDrivers, RubricBucket } from "./variance";

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

/**
 * Stage 7 -- Frontend output / admin dashboard.
 *
 * A row from `variance_reports` as persisted by persistVarianceReport
 * (src/lib/persist-report.ts). Note `confidence_score` here is the FINAL,
 * post-narrative-validation score (Stage 5's output), not Stage 4's
 * baseline -- the two are only both in memory in the live input-form flow
 * (see InputForm.tsx passing breakdown.confidence_score as
 * baselineConfidence); once persisted, only the final number survives.
 * Dashboard views built against this type should not claim to show a
 * "Stage 4 baseline" confidence, since that number isn't stored.
 */
export type VarianceReportRow = {
  id: number;
  store_id: number;
  dept_id: number;
  target_month: string;
  generated_at: string;
  mathematical_drivers: MathematicalDrivers;
  classification: Classification;
  rubric_bucket: RubricBucket;
  ai_explanation: string | null;
  confidence_score: number | null;
  system_flags: string[];
};

/**
 * Coarse severity ranking for the "risk-ranked" dashboard sort -- higher
 * means more analyst attention-worthy. Deliberately a judgment call (the
 * brief doesn't rank the 8 classifications against each other), scoped to
 * "true Anomaly first, then externally-caused misses, then routine
 * misses, then On Track last."
 */
const CLASSIFICATION_RISK_WEIGHT: Record<Classification, number> = {
  Anomaly: 6,
  "Force Majeure": 5,
  "Competitive Pressure": 5,
  "Weather Anomaly": 4,
  Volume: 3,
  Price: 3,
  Timing: 3,
  "On Track": 0,
};

export function classificationRiskWeight(classification: Classification): number {
  return CLASSIFICATION_RISK_WEIGHT[classification] ?? 0;
}

/**
 * Recent variance_reports rows for the dashboard. Fetches ordered by
 * recency and bounded by `limit` -- filtering/re-sorting (risk vs.
 * recent, classification filter) happens in the page component rather
 * than in SQL, matching this file's existing pattern of doing set
 * logic in JS after a plain Supabase read (see getDeptsForStore,
 * getAvailableMonths) rather than reaching for raw SQL/RPCs.
 */
export async function getRecentReports(limit = 200): Promise<VarianceReportRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("variance_reports")
    .select(
      "id, store_id, dept_id, target_month, generated_at, mathematical_drivers, classification, rubric_bucket, ai_explanation, confidence_score, system_flags"
    )
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load variance reports: ${error.message}`);
  return (data ?? []) as unknown as VarianceReportRow[];
}

/** A single variance_reports row for the detail page, or null if not found. */
export async function getReportById(id: number): Promise<VarianceReportRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("variance_reports")
    .select(
      "id, store_id, dept_id, target_month, generated_at, mathematical_drivers, classification, rubric_bucket, ai_explanation, confidence_score, system_flags"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load variance report ${id}: ${error.message}`);
  return (data ?? null) as unknown as VarianceReportRow | null;
}
