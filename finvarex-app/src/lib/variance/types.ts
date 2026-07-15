/**
 * Stage 4 -- Deterministic Logic Layer.
 *
 * Types for the structured variance breakdown that sits between the
 * Structured Input Form (Stage 3) and the LLM narrative layer (Stage 5).
 *
 * Everything here is a number, a label, or a flag -- never prose. Per the
 * product brief ("Why the split is the right architecture"), the LLM's
 * only job downstream is translating an already-locked set of facts into
 * a sentence. Nothing in this file or in calculate.ts should ever import
 * an LLM client or construct natural-language text.
 */

/**
 * The 8-value expanded classification from the product brief (Section 04,
 * "Expanded classification decision tree") and the variance_reports.classification
 * CHECK constraint.
 */
export type Classification =
  | "On Track"
  | "Volume"
  | "Price"
  | "Timing"
  | "Weather Anomaly"
  | "Force Majeure"
  | "Competitive Pressure"
  | "Anomaly";

/**
 * The assignment rubric's literal 4-value taxonomy. Distinct from
 * Classification -- see RUBRIC_BUCKET_LOOKUP in constants.ts and the
 * brief's Failure Mode Analysis row "Rubric taxonomy mismatch".
 */
export type RubricBucket = "Volume" | "Price" | "Timing" | "Anomaly" | null;

export type WeeklyActualInput = {
  week_date: string;
  actual_sales: number;
  is_holiday: boolean;
};

export type VarianceInput = {
  store_id: number;
  dept_id: number;
  target_month: string; // "YYYY-MM-01", one of TARGET_MONTHS
  weekly_actuals: WeeklyActualInput[];
};

export type WeeklyDriverRow = {
  week_date: string;
  iso_week: number;
  actual_sales: number;
  forecast_sales: number | null;
  model_type: string | null;
  variance_dollars: number | null;
  variance_pct: number | null;
  z_score: number | null;
  is_holiday: boolean;
  severe_weather_flag: boolean;
  markdown_total: number | null;
  markdown_z_score: number | null;
};

export type CompetitorContributor = {
  competitor_brand: string;
  distance_miles: number;
  launch_date: string;
  proximity_weight: number;
  recency_weight: number;
  contribution: number;
  data_is_synthetic: boolean;
};

export type MathematicalDrivers = {
  period: {
    store_id: number;
    dept_id: number;
    target_month: string;
    week_count: number;
  };
  totals: {
    actual_total: number;
    forecast_total: number | null;
    forecast_weeks_covered: number;
    forecast_weeks_expected: number;
  };
  variance: {
    dollars: number | null;
    pct: number | null;
    adjusted_pct: number | null;
  };
  weekly: WeeklyDriverRow[];
  largest_contributor: {
    week_date: string;
    z_score: number;
    variance_dollars: number | null;
  } | null;
  z_scores: {
    mean: number | null;
    stddev: number | null;
  };
  yoy: {
    prior_year_total: number | null;
    pct: number | null;
    weeks_matched: number;
    weeks_expected: number;
  };
  seasonal: {
    store_type: string | null;
    avg_index: number | null;
    expected_pct: number | null;
    weeks_missing_index: string[];
  };
  competitor: {
    impact_score: number;
    contributors: CompetitorContributor[];
  };
  weather: {
    severe_weather_week_count: number;
    severe_weather_weeks: string[];
  };
  price: {
    markdown_total_period: number;
    markdown_avg_weekly: number;
  };
  holiday: {
    holiday_week_count: number;
    holiday_variance_dollars: number | null;
  };
};

export type VarianceBreakdown = {
  mathematical_drivers: MathematicalDrivers;
  classification: Classification;
  rubric_bucket: RubricBucket;
  confidence_score: number;
  system_flags: string[];
};
