import type { VarianceBreakdown } from "@/lib/variance";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function pct(value: number | null): string {
  if (value === null) return "--";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function money(value: number | null): string {
  if (value === null) return "--";
  return currency.format(value);
}

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

/**
 * Renders Stage 4's structured output verbatim -- numbers, labels, and
 * flags only. There is no narrative text generated here; that is
 * deliberately Stage 5's job. This component exists so the deterministic
 * layer's output is directly inspectable before any LLM is wired in.
 */
export default function VarianceBreakdownView({
  breakdown,
}: {
  breakdown: VarianceBreakdown;
}) {
  const { mathematical_drivers: d, classification, rubric_bucket, confidence_score, system_flags } =
    breakdown;

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
            CLASSIFICATION_STYLES[classification] ?? "bg-slate-100 text-slate-800 border-slate-300"
          }`}
        >
          {classification}
        </span>
        <span className="text-xs text-slate-500">
          rubric_bucket: <span className="font-mono">{rubric_bucket ?? "null"}</span>
        </span>
        <span className="text-xs text-slate-500 ml-auto">
          confidence (Stage 4 baseline):{" "}
          <span className="font-semibold text-slate-800">{confidence_score}</span>/100
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-500">Actual</div>
          <div className="font-mono font-semibold">{money(d.totals.actual_total)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Forecast</div>
          <div className="font-mono font-semibold">{money(d.totals.forecast_total)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Variance ($ / %)</div>
          <div className="font-mono font-semibold">
            {money(d.variance.dollars)} / {pct(d.variance.pct)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Seasonal-adjusted %</div>
          <div className="font-mono font-semibold">{pct(d.variance.adjusted_pct)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-slate-100 pt-3">
        <div>
          <div className="text-xs text-slate-500">YoY %</div>
          <div className="font-mono">{pct(d.yoy.pct)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">
            Seasonal expected % {d.seasonal.store_type ? `(type ${d.seasonal.store_type})` : ""}
          </div>
          <div className="font-mono">{pct(d.seasonal.expected_pct)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Competitor impact</div>
          <div className="font-mono">{d.competitor.impact_score.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Largest contributor</div>
          <div className="font-mono">
            {d.largest_contributor
              ? `${d.largest_contributor.week_date} (z=${d.largest_contributor.z_score.toFixed(2)})`
              : "--"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1.5">Weekly breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Week</th>
                <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Actual</th>
                <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Forecast</th>
                <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Var %</th>
                <th className="text-right px-2 py-1.5 font-semibold text-slate-600">z</th>
                <th className="text-center px-2 py-1.5 font-semibold text-slate-600">Flags</th>
              </tr>
            </thead>
            <tbody>
              {d.weekly.map((w) => (
                <tr key={w.week_date} className="border-t border-slate-200">
                  <td className="px-2 py-1.5 font-mono">{w.week_date}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{money(w.actual_sales)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{money(w.forecast_sales)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{pct(w.variance_pct)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {w.z_score === null ? "--" : w.z_score.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-center space-x-1">
                    {w.is_holiday && (
                      <span className="inline-block rounded bg-amber-100 text-amber-800 px-1.5 text-[10px]">
                        holiday
                      </span>
                    )}
                    {w.severe_weather_flag && (
                      <span className="inline-block rounded bg-cyan-100 text-cyan-800 px-1.5 text-[10px]">
                        weather
                      </span>
                    )}
                    {w.model_type === "rolling_avg_fallback" && (
                      <span className="inline-block rounded bg-slate-200 text-slate-700 px-1.5 text-[10px]">
                        fallback baseline
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {d.competitor.contributors.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1.5">
            Competitor intelligence (synthetic, disclosed)
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            {d.competitor.contributors.map((c) => (
              <li key={c.competitor_brand + c.launch_date}>
                {c.competitor_brand} -- {c.distance_miles} mi, opened {c.launch_date}, contribution{" "}
                {c.contribution.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {system_flags.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1.5">System flags</div>
          <div className="flex flex-wrap gap-1.5">
            {system_flags.map((f) => (
              <span
                key={f}
                className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[11px] font-mono"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
        This is Stage 4&apos;s locked, structured output -- no narrative has been generated.
        The confidence score above is the deterministic baseline only; Stage 5 will apply
        further deductions once the LLM narrative exists and is checked against this data.
      </p>
    </div>
  );
}
