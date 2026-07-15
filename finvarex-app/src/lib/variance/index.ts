/**
 * Stage 4 -- Deterministic Logic Layer.
 *
 * Entry point: computeVarianceBreakdown(). Takes the validated Stage 3
 * payload (store/dept/month + the analyst's confirmed weekly actuals) and
 * returns a fully-computed, fully-classified VarianceBreakdown -- every
 * number, z-score, classification, rubric bucket, confidence baseline and
 * flag locked before anything is handed to Stage 5's LLM layer.
 *
 * Per the product brief: "The deterministic logic layer computes and
 * locks every number and every classification ... before the model is
 * ever called." This module is that lock. It does not import an LLM
 * client, does not construct prose, and every export here is a pure
 * function or a typed Supabase read -- there is nothing non-deterministic
 * in this directory.
 */
import {
  CONFIDENCE_BASE,
  CONFIDENCE_PENALTY_COMPETITOR_AMBIGUITY,
  CONFIDENCE_PENALTY_THIN_HISTORY,
  COMPETITOR_IMPACT_THRESHOLD,
  RUBRIC_BUCKET_LOOKUP,
} from "./constants";
import { getISOWeek } from "./date-utils";
import { classifyVariance } from "./classify";
import { computeCompetitorImpact, mean, round, stddev, zScore } from "./calculate";
import {
  getCompetitorsForStore,
  getEnvironmentalContextForWeeks,
  getForecastsForWeeks,
  getPriorYearActuals,
  getSeasonalIndexForWeeks,
} from "./queries";
import { monthEndDate } from "../reporting-window";
import type { MathematicalDrivers, VarianceBreakdown, VarianceInput, WeeklyDriverRow } from "./types";

export * from "./types";

export async function computeVarianceBreakdown(
  input: VarianceInput
): Promise<VarianceBreakdown> {
  const { store_id, dept_id, target_month, weekly_actuals } = input;
  const flags: string[] = [];

  const sortedActuals = [...weekly_actuals].sort((a, b) =>
    a.week_date.localeCompare(b.week_date)
  );
  const weekDates = sortedActuals.map((w) => w.week_date);
  const periodStart = target_month;
  const periodEnd = monthEndDate(target_month);

  // -- Fetch every input the calculation needs, in parallel. --
  const isoWeeks = weekDates.map(getISOWeek);
  const [forecastMap, envMap, competitors, seasonalMap, priorYear] = await Promise.all([
    getForecastsForWeeks(store_id, dept_id, weekDates),
    getEnvironmentalContextForWeeks(store_id, weekDates),
    getCompetitorsForStore(store_id),
    getSeasonalIndexForWeeks(dept_id, Array.from(new Set(isoWeeks))),
    getPriorYearActuals(store_id, dept_id, weekDates),
  ]);

  // -- Weekly variance + within-period z-scores. --
  // These z-scores are computed against the mean/stddev of the *weeks
  // actually submitted this period* (typically 4-5 weeks), not a full
  // historical distribution -- there isn't a persisted residual history
  // to draw on. This is the same "be honest about what the data can
  // support" trade-off the brief makes for the SARIMAX order (Section 06),
  // applied here: a period-relative outlier signal, documented as such,
  // rather than a fabricated global one.
  const variancePctByWeek: (number | null)[] = [];
  let anyFallbackModel = false;
  let anyForecastMissing = false;

  const provisionalRows = sortedActuals.map((w) => {
    const forecast = forecastMap.get(w.week_date) ?? null;
    if (!forecast) anyForecastMissing = true;
    if (forecast?.model_type === "rolling_avg_fallback") anyFallbackModel = true;

    const variance_dollars = forecast
      ? round(w.actual_sales - forecast.forecast_sales, 2)
      : null;
    const variance_pct =
      forecast && forecast.forecast_sales !== 0
        ? variance_dollars! / forecast.forecast_sales
        : null;

    variancePctByWeek.push(variance_pct);
    return { w, forecast, variance_dollars, variance_pct };
  });

  const pctMean = mean(variancePctByWeek.filter((v): v is number => v !== null));
  const pctStd = stddev(variancePctByWeek.filter((v): v is number => v !== null));

  const markdownByWeek = sortedActuals.map(
    (w) => envMap.get(w.week_date)?.markdown_total ?? null
  );
  const markdownMean = mean(markdownByWeek.filter((v): v is number => v !== null));
  const markdownStd = stddev(markdownByWeek.filter((v): v is number => v !== null));

  const weekly: WeeklyDriverRow[] = provisionalRows.map(({ w, forecast, variance_dollars, variance_pct }) => {
    const env = envMap.get(w.week_date);
    const markdown_total = env?.markdown_total ?? null;
    return {
      week_date: w.week_date,
      iso_week: getISOWeek(w.week_date),
      actual_sales: w.actual_sales,
      forecast_sales: forecast?.forecast_sales ?? null,
      model_type: forecast?.model_type ?? null,
      variance_dollars,
      variance_pct: variance_pct === null ? null : round(variance_pct, 4),
      z_score: variance_pct === null ? null : round(zScore(variance_pct, pctMean, pctStd), 3),
      is_holiday: w.is_holiday,
      severe_weather_flag: env?.severe_weather_flag ?? false,
      markdown_total,
      markdown_z_score:
        markdown_total === null ? null : round(zScore(markdown_total, markdownMean, markdownStd), 3),
    };
  });

  // -- Totals + headline variance. --
  const actual_total = round(
    sortedActuals.reduce((sum, w) => sum + w.actual_sales, 0),
    2
  );
  const forecastWeeksCovered = weekly.filter((w) => w.forecast_sales !== null).length;
  const forecast_total =
    forecastWeeksCovered > 0
      ? round(
          weekly.reduce((sum, w) => sum + (w.forecast_sales ?? 0), 0),
          2
        )
      : null;

  const variance_dollars =
    forecast_total !== null ? round(actual_total - forecast_total, 2) : null;
  const variance_pct =
    forecast_total !== null && forecast_total !== 0
      ? round(variance_dollars! / forecast_total, 4)
      : null;

  if (anyForecastMissing) flags.push("missing_forecast_week");
  if (forecast_total === 0) flags.push("zero_forecast_baseline");
  if (anyFallbackModel) flags.push("insufficient_baseline_history");

  // -- Largest-contributor isolation. --
  const weeksWithZ = weekly.filter((w) => w.z_score !== null);
  const largest_contributor =
    weeksWithZ.length > 0
      ? weeksWithZ.reduce((best, w) => (Math.abs(w.z_score!) > Math.abs(best.z_score!) ? w : best))
      : null;

  // -- Seasonal adjustment (must be applied before classification). --
  const missingIndexWeeks: string[] = [];
  const seasonalIndices: number[] = [];
  for (const w of weekly) {
    const idx = seasonalMap.get(w.iso_week);
    if (idx === undefined) {
      missingIndexWeeks.push(w.week_date);
    } else {
      seasonalIndices.push(idx);
    }
  }
  const avgSeasonalIndex = seasonalIndices.length > 0 ? mean(seasonalIndices) : null;
  const seasonalExpectedPct = avgSeasonalIndex !== null ? round(avgSeasonalIndex - 1, 4) : null;
  if (missingIndexWeeks.length > 0) flags.push("missing_seasonal_index");

  const adjusted_pct =
    variance_pct !== null && seasonalExpectedPct !== null
      ? round(variance_pct - seasonalExpectedPct, 4)
      : variance_pct;

  // -- Year-over-year (informational, no confidence penalty per the FMA
  //    table -- YoY coverage isn't one of the brief's listed penalties). --
  const yoyPct =
    priorYear.total > 0 ? round((actual_total - priorYear.total) / priorYear.total, 4) : null;
  if (priorYear.weeksMatched < weekDates.length) flags.push("insufficient_yoy_history");

  // -- Competitor impact. --
  const { impactScore, contributors } = computeCompetitorImpact(
    competitors,
    periodStart,
    periodEnd
  );
  if (impactScore >= COMPETITOR_IMPACT_THRESHOLD) flags.push("competitor_ambiguity");

  // -- Weather + holiday + price rollups (for the structured breakdown;
  //    classification reads the per-week fields directly). --
  const severeWeeks = weekly.filter((w) => w.severe_weather_flag).map((w) => w.week_date);
  const holidayWeeks = weekly.filter((w) => w.is_holiday);
  const holidayVarianceDollars = holidayWeeks.some((w) => w.variance_dollars !== null)
    ? round(
        holidayWeeks.reduce((sum, w) => sum + (w.variance_dollars ?? 0), 0),
        2
      )
    : null;
  const markdownTotalPeriod = round(
    weekly.reduce((sum, w) => sum + (w.markdown_total ?? 0), 0),
    2
  );

  const mathematical_drivers: MathematicalDrivers = {
    period: { store_id, dept_id, target_month, week_count: weekly.length },
    totals: {
      actual_total,
      forecast_total,
      forecast_weeks_covered: forecastWeeksCovered,
      forecast_weeks_expected: weekly.length,
    },
    variance: { dollars: variance_dollars, pct: variance_pct, adjusted_pct },
    weekly,
    largest_contributor: largest_contributor
      ? {
          week_date: largest_contributor.week_date,
          z_score: largest_contributor.z_score!,
          variance_dollars: largest_contributor.variance_dollars,
        }
      : null,
    z_scores: {
      mean: pctMean !== null ? round(pctMean, 4) : null,
      stddev: pctStd !== null ? round(pctStd, 4) : null,
    },
    yoy: {
      prior_year_total: priorYear.total > 0 ? round(priorYear.total, 2) : null,
      pct: yoyPct,
      weeks_matched: priorYear.weeksMatched,
      weeks_expected: weekDates.length,
    },
    seasonal: {
      avg_index: avgSeasonalIndex !== null ? round(avgSeasonalIndex, 4) : null,
      expected_pct: seasonalExpectedPct,
      weeks_missing_index: missingIndexWeeks,
    },
    competitor: { impact_score: impactScore, contributors },
    weather: {
      severe_weather_week_count: severeWeeks.length,
      severe_weather_weeks: severeWeeks,
    },
    price: {
      markdown_total_period: markdownTotalPeriod,
      markdown_avg_weekly: round(markdownTotalPeriod / Math.max(1, weekly.length), 2),
    },
    holiday: {
      holiday_week_count: holidayWeeks.length,
      holiday_variance_dollars: holidayVarianceDollars,
    },
  };

  const classification = classifyVariance(mathematical_drivers);
  const rubric_bucket = RUBRIC_BUCKET_LOOKUP[classification];

  let confidence_score = CONFIDENCE_BASE;
  if (anyFallbackModel) confidence_score -= CONFIDENCE_PENALTY_THIN_HISTORY;
  if (impactScore >= COMPETITOR_IMPACT_THRESHOLD) confidence_score -= CONFIDENCE_PENALTY_COMPETITOR_AMBIGUITY;
  confidence_score = Math.max(0, Math.min(100, confidence_score));

  return {
    mathematical_drivers,
    classification,
    rubric_bucket,
    confidence_score,
    system_flags: flags,
  };
}
