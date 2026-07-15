import {
  COMPETITOR_MAX_DISTANCE_MILES,
  COMPETITOR_ONGOING_WEIGHT,
  COMPETITOR_RECENT_WINDOW_DAYS,
} from "./constants";
import { daysBetween } from "./date-utils";
import type { CompetitorContributor } from "./types";
import type { CompetitorRow } from "./queries";

/** Population mean. Returns null for an empty array rather than NaN. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation (not sample) -- the submitted period's
 *  weeks are the entire population under review, not a sample drawn from
 *  a larger one. Returns null for fewer than 2 values. */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = mean(values.map((v) => (v - m) ** 2))!;
  return Math.sqrt(variance);
}

/** z-score of a value against a mean/stddev; 0 when stddev is 0 or
 *  unavailable (a flat series has no meaningful outlier). */
export function zScore(value: number, m: number | null, sd: number | null): number {
  if (m === null || sd === null || sd === 0) return 0;
  return (value - m) / sd;
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Competitor impact score for one store, scoped to the target period.
 *
 * Each competitor contributes proximity_weight (closer = more relevant,
 * zero past COMPETITOR_MAX_DISTANCE_MILES) times recency_weight (full
 * weight if the launch fell within COMPETITOR_RECENT_WINDOW_DAYS of the
 * period, a diminished ongoing weight if it launched earlier and is
 * still open, zero if it hasn't launched yet as of the period). The
 * total is capped at 1.0 since this is a bounded "how much of the
 * variance could plausibly be competitor-driven" signal, not an
 * unbounded sum.
 */
export function computeCompetitorImpact(
  competitors: CompetitorRow[],
  periodStart: string,
  periodEnd: string
): { impactScore: number; contributors: CompetitorContributor[] } {
  const contributors: CompetitorContributor[] = [];

  for (const c of competitors) {
    if (c.launch_date > periodEnd) {
      // Hasn't opened yet as of this period -- can't be a cause.
      continue;
    }

    const proximityWeight = Math.max(
      0,
      1 - c.distance_miles / COMPETITOR_MAX_DISTANCE_MILES
    );
    if (proximityWeight === 0) continue;

    const daysBeforePeriodStart = daysBetween(c.launch_date, periodStart);
    const isRecent = daysBeforePeriodStart <= COMPETITOR_RECENT_WINDOW_DAYS;
    const recencyWeight = isRecent ? 1 : COMPETITOR_ONGOING_WEIGHT;

    const contribution = round(proximityWeight * recencyWeight, 4);
    contributors.push({
      competitor_brand: c.competitor_brand,
      distance_miles: c.distance_miles,
      launch_date: c.launch_date,
      proximity_weight: round(proximityWeight, 4),
      recency_weight: recencyWeight,
      contribution,
      data_is_synthetic: c.data_is_synthetic,
    });
  }

  const impactScore = round(
    Math.min(1, contributors.reduce((sum, c) => sum + c.contribution, 0)),
    4
  );

  return { impactScore, contributors };
}
