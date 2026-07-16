import type { Classification } from "@/lib/variance";

/**
 * Same classification -> color mapping as VarianceBreakdownView's local
 * CLASSIFICATION_STYLES, pulled out here so the dashboard list and detail
 * pages can share one badge without importing a component tree built for
 * the live input-form flow.
 */
const CLASSIFICATION_STYLES: Record<string, string> = {
  "On Track": "bg-emerald-50 text-emerald-800 border-emerald-300",
  Volume: "bg-sky-50 text-sky-800 border-sky-300",
  Price: "bg-violet-50 text-violet-800 border-violet-300",
  Timing: "bg-amber-50 text-amber-800 border-amber-300",
  "Weather Anomaly": "bg-cyan-50 text-cyan-800 border-cyan-300",
  "Force Majeure": "bg-red-50 text-red-800 border-red-300",
  "Competitive Pressure": "bg-orange-50 text-orange-800 border-orange-300",
  Anomaly: "bg-slate-100 text-slate-800 border-slate-300",
};

export default function ClassificationBadge({
  classification,
}: {
  classification: Classification;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        CLASSIFICATION_STYLES[classification] ?? "bg-slate-100 text-slate-800 border-slate-300"
      }`}
    >
      {classification}
    </span>
  );
}
