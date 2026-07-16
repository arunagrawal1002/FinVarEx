/**
 * Narrative display for a persisted variance_reports row. Deliberately a
 * separate component from input/NarrativeView.tsx rather than a reuse of
 * it -- that component's props (baselineConfidence, forbidden_topic_hits,
 * contradicted) only exist together in memory during the live Stage
 * 4 -> 5 flow (see InputForm.tsx). Once a report is persisted, only the
 * final confidence_score and the merged system_flags array survive
 * (see persist-report.ts), so this view shows exactly those, without
 * claiming a "docked from baseline X" breakdown it can't actually prove.
 */
export default function PersistedNarrativeView({
  narrative,
  confidence_score,
  system_flags,
}: {
  narrative: string | null;
  confidence_score: number | null;
  system_flags: string[];
}) {
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
          Stage 5 -- Narrative (persisted)
        </span>
        <span className="text-xs text-slate-500">
          confidence: <span className="font-semibold text-slate-800">{confidence_score ?? "--"}</span>/100
        </span>
      </div>

      <p className="text-sm text-slate-800 leading-relaxed italic">
        {narrative ? `“${narrative}”` : "No narrative was generated for this report."}
      </p>

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

      <p className="text-[11px] text-slate-400 border-t border-indigo-100 pt-2">
        This is the audit record written by Stage 6 (persist-report.ts) at generation time --
        the flags shown are whatever Stage 4 and Stage 5 raised, merged together; the
        original Stage 4 baseline confidence (pre-narrative) is not separately persisted.
      </p>
    </div>
  );
}
