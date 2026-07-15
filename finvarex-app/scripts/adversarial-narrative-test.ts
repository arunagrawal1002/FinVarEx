/**
 * Adversarial check for Stage 5's post-hoc safety net (src/lib/narrative/validate.ts).
 *
 * This does NOT call the live LLM. It tests the independent validator
 * directly: given a hand-crafted narrative that violates the prompt
 * boundary (mentions a topic the data doesn't support, or gets the
 * variance direction backwards), does scanForbiddenTopics /
 * checkContradiction actually catch it? That's the real safety
 * guarantee -- not whether the model behaves, but whether we catch it
 * when it doesn't.
 *
 * Run: npx tsx scripts/adversarial-narrative-test.ts
 */
import { scanForbiddenTopics, checkContradiction } from "../src/lib/narrative/validate";
import { FORBIDDEN_TOPIC_PENALTY, CONTRADICTION_PENALTY } from "../src/lib/narrative/constants";

// Minimal driver fixture builder -- only fields the checks actually read.
function baseDrivers(overrides: any = {}) {
  return {
    period: { store_id: 1, dept_id: 1, target_month: "2012-06-01", week_count: 4 },
    totals: { actual_total: 100000, forecast_total: 120000, forecast_weeks_covered: 4, forecast_weeks_expected: 4 },
    variance: { dollars: -20000, pct: -0.1667, adjusted_pct: -0.1667 },
    weekly: [
      {
        week_date: "2012-06-08",
        iso_week: 23,
        actual_sales: 25000,
        forecast_sales: 30000,
        model_type: "holt-winters",
        variance_dollars: -5000,
        variance_pct: -0.1667,
        z_score: 0.4,
        is_holiday: false,
        severe_weather_flag: false,
        markdown_total: 0,
        markdown_z_score: -0.5,
      },
    ],
    largest_contributor: { week_date: "2012-06-08", z_score: 0.4, variance_dollars: -5000 },
    z_scores: { mean: 0.4, stddev: 0.2 },
    yoy: { prior_year_total: 118000, pct: -0.15, weeks_matched: 4, weeks_expected: 4 },
    seasonal: { store_type: "A", avg_index: 1.02, expected_pct: 0.02, weeks_missing_index: [] },
    competitor: { impact_score: 0.05, contributors: [] },
    weather: { severe_weather_week_count: 0, severe_weather_weeks: [] },
    price: { markdown_total_period: 0, markdown_avg_weekly: 0 },
    holiday: { holiday_week_count: 0, holiday_variance_dollars: null },
    ...overrides,
  };
}

type Case = { name: string; narrative: string; drivers: any; expectTopicHits: string[]; expectContradiction: boolean };

const cases: Case[] = [
  {
    name: "Forbidden topic: weather mentioned, no real weather driver (z=0.4, flag=false)",
    narrative: "Unseasonably heavy storm activity and snow suppressed foot traffic this period.",
    drivers: baseDrivers(),
    expectTopicHits: ["forbidden_topic:weather"],
    expectContradiction: false,
  },
  {
    name: "Forbidden topic: competitor mentioned, impact_score=0.05 (below 0.2 threshold)",
    narrative: "A new competitor opened nearby and pulled customers away this quarter.",
    drivers: baseDrivers(),
    expectTopicHits: ["forbidden_topic:competitor"],
    expectContradiction: false,
  },
  {
    name: "Forbidden topic: markdown mentioned, markdown_z_score=-0.5 (below 1.0 threshold)",
    narrative: "Aggressive clearance pricing and promotions drove the shortfall.",
    drivers: baseDrivers(),
    expectTopicHits: ["forbidden_topic:price_markdown"],
    expectContradiction: false,
  },
  {
    name: "Contradiction: negative variance (-16.7%) but narrative says growth",
    narrative: "Sales grew and exceeded expectations this period, a strong outperformance.",
    drivers: baseDrivers(),
    expectTopicHits: [],
    expectContradiction: true,
  },
  {
    name: "Combined attack: unsupported weather claim + wrong direction, single narrative",
    narrative: "Severe storms drove strong growth, with sales rising well above forecast.",
    drivers: baseDrivers(),
    expectTopicHits: ["forbidden_topic:weather"],
    expectContradiction: true,
  },
  {
    name: "Control: weather IS a real driver (flag=true, z=2.1) -- should NOT be flagged",
    narrative: "A severe winter storm suppressed store traffic and drove the shortfall.",
    drivers: baseDrivers({
      weekly: [
        {
          week_date: "2012-06-08",
          iso_week: 23,
          actual_sales: 25000,
          forecast_sales: 30000,
          model_type: "holt-winters",
          variance_dollars: -5000,
          variance_pct: -0.1667,
          z_score: 2.1,
          is_holiday: false,
          severe_weather_flag: true,
          markdown_total: 0,
          markdown_z_score: -0.5,
        },
      ],
      largest_contributor: { week_date: "2012-06-08", z_score: 2.1, variance_dollars: -5000 },
    }),
    expectTopicHits: [],
    expectContradiction: false,
  },
  {
    name: "Control: correctly-worded negative narrative for negative variance -- should NOT contradict",
    narrative: "Sales declined and missed forecast this period, driven by soft volume.",
    drivers: baseDrivers(),
    expectTopicHits: [],
    expectContradiction: false,
  },
];

let pass = 0;
let fail = 0;

for (const c of cases) {
  const hits = scanForbiddenTopics(c.narrative, c.drivers);
  const contradicted = checkContradiction(c.narrative, c.drivers);

  const hitsOk = JSON.stringify(hits.sort()) === JSON.stringify(c.expectTopicHits.sort());
  const contradictOk = contradicted === c.expectContradiction;
  const ok = hitsOk && contradictOk;

  const penalty = hits.length * FORBIDDEN_TOPIC_PENALTY + (contradicted ? CONTRADICTION_PENALTY : 0);

  console.log(`${ok ? "PASS" : "FAIL"} -- ${c.name}`);
  console.log(`  narrative: "${c.narrative}"`);
  console.log(`  topic hits: [${hits.join(", ")}] (expected [${c.expectTopicHits.join(", ")}])`);
  console.log(`  contradicted: ${contradicted} (expected ${c.expectContradiction})`);
  console.log(`  confidence penalty this would apply: -${penalty}`);
  console.log("");

  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass}/${cases.length} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
