/**
 * The ARIMA reporting window from the Data Architecture v3 doc (Section 5):
 * forecasts only exist for May-Oct 2012, so that is the only window the
 * Structured Input Form can offer as a "target month".
 */
export const REPORTING_WINDOW_START = "2012-05-01";
export const REPORTING_WINDOW_END = "2012-10-31";

export const TARGET_MONTHS = [
  { value: "2012-05-01", label: "May 2012" },
  { value: "2012-06-01", label: "June 2012" },
  { value: "2012-07-01", label: "July 2012" },
  { value: "2012-08-01", label: "August 2012" },
  { value: "2012-09-01", label: "September 2012" },
  { value: "2012-10-01", label: "October 2012" },
] as const;

export function monthEndDate(monthStartIso: string): string {
  const d = new Date(monthStartIso + "T00:00:00Z");
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}
