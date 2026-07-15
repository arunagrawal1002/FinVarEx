import {
  COMPETITOR_IMPACT_THRESHOLD,
  FORCE_MAJEURE_THRESHOLD_PCT,
  ON_TRACK_THRESHOLD_PCT,
  PRICE_MARKDOWN_Z_THRESHOLD,
  WEATHER_Z_THRESHOLD,
} from "./constants";
import type { Classification, MathematicalDrivers } from "./types";

/**
 * The expanded 8-value classification decision tree (product brief,
 * Section 04). This is the one function in the whole module where order
 * matters: it is a genuine decision *tree*, evaluated top to bottom, and
 * the first branch that matches wins. Reordering these checks changes
 * classifications, so the rationale for the order is documented inline
 * rather than left implicit.
 *
 * Design invariants carried over from the brief's Failure Mode Analysis:
 *  - Runs on adjustedVariancePct (seasonal-adjusted), never on raw
 *    variance -- a normal seasonal swing must not be misread as an
 *    anomaly (FMA row "Normal seasonal swing misread as an anomaly").
 *  - Every branch below "On Track" requires a concrete, checkable signal
 *    (a flagged week, a threshold breach) rather than falling back to a
 *    plausible-sounding guess -- that's the whole reason this logic lives
 *    here instead of being left to the LLM.
 */
export function classifyVariance(drivers: MathematicalDrivers): Classification {
  const signalPct = drivers.variance.adjusted_pct ?? drivers.variance.pct;

  // No usable forecast baseline at all -- nothing downstream can be
  // trusted as a specific cause, so this is an unclassifiable anomaly
  // rather than a guess dressed up as one of the other seven labels.
  if (signalPct === null) return "Anomaly";

  if (Math.abs(signalPct) < ON_TRACK_THRESHOLD_PCT) return "On Track";

  const largest = drivers.largest_contributor;
  const largestWeek = largest
    ? drivers.weekly.find((w) => w.week_date === largest.week_date)
    : undefined;

  // 1. Weather: checked first because a severe-weather week is the
  //    hardest signal to fake and the most likely to be genuinely
  //    exogenous -- if it coincides with the period's single biggest
  //    swing week, it outranks softer explanations like a price/promo
  //    correlation.
  if (
    largestWeek?.severe_weather_flag &&
    Math.abs(largest!.z_score) >= WEATHER_Z_THRESHOLD
  ) {
    return Math.abs(signalPct) >= FORCE_MAJEURE_THRESHOLD_PCT
      ? "Force Majeure"
      : "Weather Anomaly";
  }

  // 2. Competitive pressure: only claimed for a miss (negative signal),
  //    since a nearby competitor opening can plausibly pull demand away
  //    but can't plausibly explain a beat.
  if (
    drivers.competitor.impact_score >= COMPETITOR_IMPACT_THRESHOLD &&
    signalPct < 0
  ) {
    return "Competitive Pressure";
  }

  // 3. Price: the biggest-swing week also shows unusually elevated
  //    markdown/promotional activity relative to the rest of the period.
  if (
    largestWeek?.markdown_z_score !== null &&
    largestWeek?.markdown_z_score !== undefined &&
    largestWeek.markdown_z_score >= PRICE_MARKDOWN_Z_THRESHOLD
  ) {
    return "Price";
  }

  // 4. Timing: the biggest-swing week is a holiday week -- a calendar
  //    shift (e.g. a holiday landing in a different week than the
  //    forecast's exogenous calendar assumed) rather than a demand or
  //    price effect.
  if (largestWeek?.is_holiday) {
    return "Timing";
  }

  // 5. Volume: none of the above checkable signals apply, but the miss
  //    is broad enough (not concentrated in one anomalous week) to read
  //    as a genuine demand-level shift rather than noise. A z-score below
  //    the weather threshold on every week is the marker of "broad", not
  //    "spiky".
  if (!largest || Math.abs(largest.z_score) < WEATHER_Z_THRESHOLD) {
    return "Volume";
  }

  // 6. Anomaly: there IS a concentrated, high-z-score week driving the
  //    variance, but none of the available deterministic signals
  //    (weather, competitor, price, holiday) explain it. Reporting this
  //    honestly as unexplained is the point of the whole architecture --
  //    the alternative would be an LLM inventing a cause for it.
  return "Anomaly";
}
