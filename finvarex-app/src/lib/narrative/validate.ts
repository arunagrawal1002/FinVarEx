import type { MathematicalDrivers } from "@/lib/variance";
import { FORBIDDEN_TOPIC_Z_THRESHOLD } from "./constants";

/**
 * Post-hoc checks on the LLM's output. This file is the automated,
 * deterministic side of the brief's Failure Mode Analysis table -- it
 * does not trust the prompt boundary to have worked, it verifies the
 * result independently. Both checks run regardless of what the prompt
 * said; a model that ignores its instructions is exactly the case these
 * exist to catch.
 */

type TopicCheck = {
  topic: string;
  pattern: RegExp;
  isAllowed: (d: MathematicalDrivers) => boolean;
};

function largestContributorWeek(d: MathematicalDrivers) {
  if (!d.largest_contributor) return undefined;
  return d.weekly.find((w) => w.week_date === d.largest_contributor!.week_date);
}

const TOPIC_CHECKS: TopicCheck[] = [
  {
    topic: "weather",
    pattern: /\b(weather|storm\w*|snow\w*|rain\w*|hurricane\w*|blizzard\w*|flood\w*|heatwave\w*)\b/i,
    isAllowed: (d) => {
      const week = largestContributorWeek(d);
      return Boolean(
        week?.severe_weather_flag &&
          d.largest_contributor &&
          Math.abs(d.largest_contributor.z_score) >= FORBIDDEN_TOPIC_Z_THRESHOLD
      );
    },
  },
  {
    topic: "competitor",
    pattern: /\b(competitor\w*|competition\w*|rival\w*|opened nearby|new store nearby)\b/i,
    isAllowed: (d) => d.competitor.impact_score >= 0.2,
  },
  {
    topic: "price_markdown",
    pattern: /\b(markdown\w*|promotion\w*|promo\w*|discount\w*|price cut\w*|clearance\w*)\b/i,
    isAllowed: (d) => {
      const week = largestContributorWeek(d);
      return (week?.markdown_z_score ?? -Infinity) >= 1.0;
    },
  },
  {
    topic: "holiday_timing",
    pattern: /\b(holiday\w*|calendar shift\w*)\b/i,
    isAllowed: (d) => Boolean(largestContributorWeek(d)?.is_holiday),
  },
];

/**
 * Scans the generated narrative for topic mentions that aren't backed by
 * a significant driver in the data. Returns one flag string per
 * unsupported topic mentioned (e.g. "forbidden_topic:weather").
 */
export function scanForbiddenTopics(narrative: string, drivers: MathematicalDrivers): string[] {
  const hits: string[] = [];
  for (const check of TOPIC_CHECKS) {
    if (check.pattern.test(narrative) && !check.isAllowed(drivers)) {
      hits.push(`forbidden_topic:${check.topic}`);
    }
  }
  return hits;
}

const POSITIVE_WORDS =
  /\b(grew|grow|growth|increase[ds]?|beat|exceeded|outperform(?:ed|ing)?|gained?|rose|higher|surge[ds]?|up\b)/i;
const NEGATIVE_WORDS =
  /\b(miss(?:ed)?|declin(?:e|ed|ing)|decrease[ds]?|fell|fall(?:ing)?|shortfall|under-?perform(?:ed|ing)?|down\b|lower|drop(?:ped)?)/i;

/**
 * Compares the narrative's directional language against the computed
 * sign of the variance. A narrative that describes growth for a negative
 * variance (or vice versa) fails this check regardless of everything
 * else being accurate -- getting the direction backwards is the single
 * most credibility-destroying error this product exists to prevent.
 */
export function checkContradiction(narrative: string, drivers: MathematicalDrivers): boolean {
  const signal = drivers.variance.adjusted_pct ?? drivers.variance.pct;
  if (signal === null || Math.abs(signal) < 0.001) return false;

  const hasPositive = POSITIVE_WORDS.test(narrative);
  const hasNegative = NEGATIVE_WORDS.test(narrative);

  if (signal < 0 && hasPositive && !hasNegative) return true;
  if (signal > 0 && hasNegative && !hasPositive) return true;
  return false;
}
