import type { Classification, RubricBucket } from "./types";

/**
 * Stage 4 thresholds. Every number here is a deliberate, documented
 * judgment call -- not a fitted parameter -- because there isn't enough
 * historical volume per store/dept/month to fit them statistically. Each
 * is commented with its rationale so a reviewer can contest the number
 * without having to reverse-engineer the code.
 */

/** Below this |adjusted variance %|, a miss is noise, not a story. */
export const ON_TRACK_THRESHOLD_PCT = 0.05;

/** Weather-linked variance at or above this magnitude escalates from
 *  "Weather Anomaly" to "Force Majeure" -- the difference between a bad
 *  week and a week worth flagging to leadership as exceptional. */
export const FORCE_MAJEURE_THRESHOLD_PCT = 0.3;

/** A week's own z-score (relative to the other weeks in the submitted
 *  period) must clear this bar before a severe_weather_flag on that week
 *  is treated as causal rather than coincidental. */
export const WEATHER_Z_THRESHOLD = 1.5;

/** Matches the product brief's Failure Mode Analysis row verbatim:
 *  "competitor_impact_score >= 0.2 check" triggers a confidence coverage
 *  penalty regardless of whether competitor pressure is the headline
 *  driver, and is also the bar for naming it the headline driver here. */
export const COMPETITOR_IMPACT_THRESHOLD = 0.2;

/** A competitor launch within this many days of the target month is
 *  treated as still actively reshaping demand; older launches count for
 *  a diminished, ongoing "structural" weight instead of zero. */
export const COMPETITOR_RECENT_WINDOW_DAYS = 182; // ~6 months

/** Ongoing (non-recent) competitor pressure still counts, just at half
 *  weight -- a competitor that opened a year ago hasn't stopped mattering,
 *  it's just no longer the newest explanation. */
export const COMPETITOR_ONGOING_WEIGHT = 0.5;

/** Beyond this distance, a competitor is judged too far away to plausibly
 *  be pulling traffic from this specific store. */
export const COMPETITOR_MAX_DISTANCE_MILES = 5;

/** A week's markdown activity must be at least this many (within-period)
 *  standard deviations above the period mean, on the same week that
 *  dominates the variance, before "Price" is chosen over "Volume". */
export const PRICE_MARKDOWN_Z_THRESHOLD = 1.0;

/**
 * Fixed lookup from the 8-value expanded classification to the
 * assignment rubric's literal 4-value taxonomy (Volume, Price, Timing,
 * Anomaly). This is the brief's documented hedge against "Rubric taxonomy
 * mismatch" (FMA table) -- shown alongside `classification`, never
 * replacing it.
 *
 * Rationale for the non-obvious mappings:
 *  - On Track has no variance to bucket, so it maps to null.
 *  - Weather Anomaly / Force Majeure are exogenous shocks the rubric's
 *    four categories don't literally name -- both fold into Anomaly.
 *  - Competitive Pressure is demand pulled away by a competitor, which is
 *    a volume effect on this store's ledger even though its root cause is
 *    external -- it folds into Volume.
 */
export const RUBRIC_BUCKET_LOOKUP: Record<Classification, RubricBucket> = {
  "On Track": null,
  Volume: "Volume",
  Price: "Price",
  Timing: "Timing",
  "Weather Anomaly": "Anomaly",
  "Force Majeure": "Anomaly",
  "Competitive Pressure": "Volume",
  Anomaly: "Anomaly",
};

/**
 * Confidence score baseline. Stage 4 only applies the two coverage
 * penalties that are knowable before the LLM is ever called (per the
 * brief's FMA table). The forbidden-topic (-25/hit) and math-contradiction
 * (-20/hit) penalties are post-hoc checks on the LLM's *output* and belong
 * to Stage 5 -- they are applied on top of this baseline, never here.
 */
export const CONFIDENCE_BASE = 100;
export const CONFIDENCE_PENALTY_THIN_HISTORY = 10;
export const CONFIDENCE_PENALTY_COMPETITOR_AMBIGUITY = 20;
