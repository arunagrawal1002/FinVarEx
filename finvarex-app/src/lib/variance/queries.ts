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

/** Seasonal multipliers for this department, for the specific ISO weeks
 *  under review. */
export async function getSeasonalIndexForWeeks(
  deptId: number,
  isoWeeks: number[]
): Promise<Map<number, number>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("seasonal_index")
    .select("iso_week, seasonal_index")
    .eq("dept_id", deptId)
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
