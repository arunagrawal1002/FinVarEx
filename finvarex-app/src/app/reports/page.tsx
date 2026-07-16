import Link from "next/link";
import { Suspense } from "react";
import {
  classificationRiskWeight,
  getRecentReports,
  type VarianceReportRow,
} from "@/lib/queries";
import type { Classification } from "@/lib/variance";
import ClassificationBadge from "./ClassificationBadge";
import ReportsFilters from "./ReportsFilters";

// Live dashboard over variance_reports -- always hit Supabase fresh, same
// as /input (see that page's dynamic export for the same reasoning).
export const dynamic = "force-dynamic";

const pctFormat = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "--";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
};

const dateFormat = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

function sortReports(
  reports: VarianceReportRow[],
  sort: "risk" | "recent"
): VarianceReportRow[] {
  const copy = [...reports];
  if (sort === "recent") {
    copy.sort(
      (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    );
    return copy;
  }

  // Risk-ranked (default): classification severity first, then lower
  // confidence first within the same severity tier, then most recent.
  copy.sort((a, b) => {
    const weightDiff =
      classificationRiskWeight(b.classification) - classificationRiskWeight(a.classification);
    if (weightDiff !== 0) return weightDiff;

    const confA = a.confidence_score ?? 100;
    const confB = b.confidence_score ?? 100;
    if (confA !== confB) return confA - confB;

    return new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
  });
  return copy;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ classification?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const classificationFilter = (params.classification as Classification | undefined) || undefined;
  const sort = params.sort === "recent" ? "recent" : "risk";

  const allReports = await getRecentReports(200);
  const filtered = classificationFilter
    ? allReports.filter((r) => r.classification === classificationFilter)
    : allReports;
  const reports = sortReports(filtered, sort);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-5xl space-y-6">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            Reports Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Every persisted <code>variance_reports</code> row (Stage 6&apos;s audit
            log), risk-ranked by default so the classifications and low-confidence
            reports most worth an analyst&apos;s attention surface first --
            the lighter-weight cousin of the brief&apos;s Portfolio Anomaly Queue
            concept, built over reports that already exist rather than a full
            batch scan of every store/dept combination.
          </p>
        </div>

        <Suspense fallback={<div className="h-16" />}>
          <ReportsFilters />
        </Suspense>

        <p className="text-xs text-slate-500">
          {reports.length} report{reports.length === 1 ? "" : "s"}
          {classificationFilter ? ` -- classification: ${classificationFilter}` : ""}
        </p>

        {reports.length === 0 ? (
          <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No reports yet. Generate one from the{" "}
            <Link href="/input" className="underline">
              structured input form
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600">
                    Generated
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600">
                    Store / Dept / Month
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600">
                    Classification
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600">
                    Rubric
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">
                    Variance %
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">
                    Confidence
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">
                    Flags
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {dateFormat(r.generated_at)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                      {r.store_id} / {r.dept_id} / {r.target_month.slice(0, 7)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ClassificationBadge classification={r.classification} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                      {r.rubric_bucket ?? "null"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {pctFormat(r.mathematical_drivers?.variance?.pct)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {r.confidence_score ?? "--"}/100
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {r.system_flags.length > 0 ? (
                        <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-1.5 text-[11px] font-mono">
                          {r.system_flags.length}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/reports/${r.id}`}
                        className="text-xs font-semibold text-slate-700 hover:underline whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
