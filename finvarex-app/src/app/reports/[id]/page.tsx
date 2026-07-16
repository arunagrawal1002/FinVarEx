import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportById } from "@/lib/queries";
import type { VarianceBreakdown } from "@/lib/variance";
import VarianceBreakdownView from "../../input/VarianceBreakdownView";
import ClassificationBadge from "../ClassificationBadge";
import PersistedNarrativeView from "../PersistedNarrativeView";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) notFound();

  const report = await getReportById(reportId);
  if (!report) notFound();

  // Reconstructs the same VarianceBreakdown shape Stage 4 produces live,
  // from the persisted columns -- mathematical_drivers was written
  // verbatim from breakdown.mathematical_drivers in persist-report.ts, so
  // this is a lossless rebuild of everything except the Stage 4 baseline
  // confidence (see confidenceLabel/footerNote below).
  const breakdown: VarianceBreakdown = {
    mathematical_drivers: report.mathematical_drivers,
    classification: report.classification,
    rubric_bucket: report.rubric_bucket,
    confidence_score: report.confidence_score ?? 0,
    system_flags: report.system_flags,
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <Link href="/reports" className="text-xs text-slate-500 hover:underline">
            ← Back to reports
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Report #{report.id}
            </h1>
            <ClassificationBadge classification={report.classification} />
          </div>
          <p className="mt-1 text-sm text-slate-600 font-mono">
            Store {report.store_id} / Dept {report.dept_id} / {report.target_month.slice(0, 7)}
            {" -- "}generated {new Date(report.generated_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        <VarianceBreakdownView
          breakdown={breakdown}
          confidenceLabel="final, persisted"
          footerNote="This is the Stage 4 math exactly as it was locked and persisted with this report --
            reconstructed here from variance_reports.mathematical_drivers, not recomputed. The
            confidence shown is the final post-narrative score (Stage 4's pre-narrative baseline
            isn't stored separately once a report is saved)."
        />

        <PersistedNarrativeView
          narrative={report.ai_explanation}
          confidence_score={report.confidence_score}
          system_flags={report.system_flags}
        />
      </div>
    </main>
  );
}
