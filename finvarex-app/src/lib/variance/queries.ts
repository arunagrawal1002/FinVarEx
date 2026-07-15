import { getSupabaseServerClient } from "../supabase-server";
import { priorYearWeekDate } from "./date-utils";

export type ForecastRow = {
  week_date: string;
  forecast_sales: number;
  model_type: string | null;
};

export type EnvContextRow = {
  week_date: string;
  markdown_total: number | null;
  severe_weather_flag: boolean | null;
};

export type CompetitorRow = {
  competitor_brand: string;
  distance_miles: number;
  launch_date: string;
  data_is_synthetic: boolean;
};

export type SeasonalIndexRow = {
  iso_week: number;
  seasonal_index: number;
};

/**
 * A store's format/size class (A/B/C -- an authentic field from the
 * source data, not synthetic). Used to look up the right seasonal_index
 * bucket -- see getSeasonalIndexForWeeks for why this matters more than
 * region.
 */
export async function getStoreType(storeId: number): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("stores")
    .select("type")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load store type: ${error.message}`);

  return (data as { type: string | null } | null)?.type ?? null;
}

/** Forecast baseline for the exact weeks under review (Stage 4 never
 *  fits or re-derives a forecast -- it only reads the offline SARIMAX
 *  output per the brief's "Speed vs. Accuracy" trade-off). */
export async function getForecastsForWeeks(
  storeId: number,
  deptId: number,
  weekDates: string[]
): Promise<Map<string, ForecastRow>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_forecasts")
    .select("week_date, forecast_sales, model_type")
    .eq("store_id", storeId)
    .eq("dept_id", deptId)
    .in("week_date", weekDates);

  if (error) throw new Error(`Failed to load forecasts: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    week_date: string;
    forecast_sales: number | string;
    model_type: string | null;
  }[];

  const map = new Map<string, ForecastRow>();
  for (const r of rows) {
    map.set(r.week_date, {
      week_date: r.week_date,
      forecast_sales: Number(r.forecast_sales),
      model_type: r.model_type,
    });
  }
  return map;
}

/** Store-level weekly context (weather, markdown, macro). Environmental
 *  context is keyed by store only, not store+dept -- it applies to every
 *  department at that location. */
export async function getEnvironmentalContextForWeeks(
  storeId: number,
  weekDates: string[]
): Promise<Map<string, EnvContextRow>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_environmental_context")
    .select("week_date, markdown_total, severe_weather_flag")
    .eq("store_id", storeId)
    .in("week_date", weekDates);

  if (error) throw new Error(`Failed to load environmental context: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    week_date: string;
    markdown_total: number | string | null;
    severe_weather_flag: boolean | null;
  }[];

  const map = new Map<string, EnvContextRow>();
  for (const r of rows) {
    map.set(r.week_date, {
      week_date: r.week_date,
      markdown_total: r.markdown_total === null ? null : Number(r.markdown_total),
      severe_weather_flag: r.severe_weather_flag,
    });
  }
  return map;
}

/** All disclosed-synthetic competitor rows for this store. Sparse by
 *  design -- most stores have zero rows, which is a valid ("no known
 *  nearby competitor activity") result, not an error. */
export async function getCompetitorsForStore(storeId: number): Promise<CompetitorRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("competitor_intelligence")
    .select("competitor_brand, distance_miles, launch_date, data_is_synthetic")
    .eq("store_id", storeId);

  if (error) throw new Error(`Failed to load competitor intelligence: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    competitor_brand: string;
    distance_miles: number | string;
    launch_date: string;
    data_is_synthetic: boolean | null;
  }[];

  return rows.map((r) => ({
    competitor_brand: r.competitor_brand,
    distance_miles: Number(r.distance_miles),
    launch_date: r.launch_date,
    data_is_synthetic: Boolean(r.data_is_synthetic),
  }));
}

/**
 * Seasonal multipliers for this department, scoped to the store's own
 * format/size class (store_type), for the specific ISO weeks under
 * review.
 *
 * seasonal_index is keyed on (dept_id, store_type, iso_week), not just
 * (dept_id, iso_week) -- pooling across all 45 stores per department was
 * validated to be a materially poor fit for many individual stores
 * (within-dept store-vs-pooled-index correlation as low as 0.51, some
 * stores near-zero or negative). store_type turned out to be the real,
 * consistent driver of that heterogeneity (65/71 departments show
 * same-type stores correlating higher than cross-type stores);
 * region/climate was tested and ruled out, since stores.region_name is
 * synthetic in this dataset. See supabase/migrations/
 * 20260715120000_rekey_seasonal_index_by_store_type.sql for the full
 * validation writeup.
 *
 * If storeType is null (shouldn't happen for a seeded store, but the
 * `stores.type` column has no NOT NULL constraint), this returns an
 * empty map -- the caller's missing_seasonal_index flag handles that
 * gracefully rather than silently falling back to the old pooled
 * behavior.
 */
export async function getSeasonalIndexForWeeks(
  deptId: number,
  isoWeeks: number[],
  storeType: string | null
): Promise<Map<number, number>> {
  if (!storeType) return new Map();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("seasonal_index")
    .select("iso_week, seasonal_index")
    .eq("dept_id", deptId)
    .eq("store_type", storeType)
    .in("iso_week", isoWeeks);

  if (error) throw new Error(`Failed to load seasonal index: ${error.message}`);

  const rows = (data ?? []) as unknown as SeasonalIndexRow[];
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.iso_week, Number(r.seasonal_index));
  }
  return map;
}

/**
 * Sum of actual sales for the same store/dept, one year earlier, using
 * the same weekday grid (see date-utils.priorYearWeekDate). Returns both
 * the sum and how many of the requested weeks actually matched a row, so
 * the caller can tell a fully-covered YoY comparison from a partial one.
 */
export async function getPriorYearActuals(
  storeId: number,
  deptId: number,
  weekDates: string[]
): Promise<{ total: number; weeksMatched: number }> {
  const priorDates = weekDates.map(priorYearWeekDate);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_actuals")
    .select("week_date, actual_sales")
    .eq("store_id", storeId)
    .eq("dept_id", deptId)
    .in("week_date", priorDates);

  if (error) throw new Error(`Failed to load prior-year actuals: ${error.message}`);

  const rows = (data ?? []) as unknown as { week_date: string; actual_sales: number | string }[];
  const total = rows.reduce((sum, r) => sum + Number(r.actual_sales), 0);
  return { total, weeksMatched: rows.length };
}
