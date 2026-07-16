"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Classification } from "@/lib/variance";

const CLASSIFICATIONS: Classification[] = [
  "Anomaly",
  "Force Majeure",
  "Competitive Pressure",
  "Weather Anomaly",
  "Volume",
  "Price",
  "Timing",
  "On Track",
];

/**
 * Filter/sort controls for the reports dashboard. Client component only
 * because it needs to read/write the URL's query string on change --
 * the actual data fetch, filter, and sort all happen server-side in
 * page.tsx, keyed off these same search params.
 */
export default function ReportsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const classification = searchParams.get("classification") ?? "";
  const sort = searchParams.get("sort") ?? "risk";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Sort
        </label>
        <select
          className="rounded-lg border border-slate-300 p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          <option value="risk">Risk-ranked (attention-worthy first)</option>
          <option value="recent">Most recent first</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Classification
        </label>
        <select
          className="rounded-lg border border-slate-300 p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          value={classification}
          onChange={(e) => updateParam("classification", e.target.value)}
        >
          <option value="">All classifications</option>
          {CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
