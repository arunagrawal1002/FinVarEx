/**
 * Date helpers for the Stage 4 logic layer. All arithmetic is done in UTC
 * on "YYYY-MM-DD" strings to avoid local-timezone drift shifting a date
 * across a week boundary.
 */

/** ISO-8601 week number (1-52/53), used to key into seasonal_index. */
export function getISOWeek(dateIso: string): number {
  const date = new Date(dateIso + "T00:00:00Z");
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // nearest Thursday
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCDate(1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.round((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
}

/** Shifts a "YYYY-MM-DD" date by a number of days (may be negative). */
export function shiftDateDays(dateIso: string, days: number): string {
  const date = new Date(dateIso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Same weekday, one year earlier -- used for the YoY comparison. The
 * Kaggle Walmart weekly cadence is a fixed 7-day grid, so shifting by
 * exactly 364 days (52 weeks) lands on the same weekday and the same
 * relative point in the retail calendar, rather than the calendar date
 * exactly one year back (which would drift onto the wrong weekday).
 */
export function priorYearWeekDate(dateIso: string): string {
  return shiftDateDays(dateIso, -364);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00Z").valueOf();
  const to = new Date(toIso + "T00:00:00Z").valueOf();
  return Math.round((to - from) / (24 * 3600 * 1000));
}
