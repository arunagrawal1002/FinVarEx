"use client";

import { useState, useTransition } from "react";
import type { StoreOption, WeeklyActualRow } from "@/lib/queries";
import type { VarianceBreakdown } from "@/lib/variance";
import { TARGET_MONTHS } from "@/lib/reporting-window";
import { validateInputForm, type FieldErrors } from "@/lib/validation";
import { computeVariance, fetchDepts, fetchMonths, fetchWeeklyActuals, submitInput } from "./actions";
import VarianceBreakdownView from "./VarianceBreakdownView";

type MonthOption = { value: string; label: string };

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function InputForm({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState<number | "">("");
  const [depts, setDepts] = useState<number[]>([]);
  const [deptId, setDeptId] = useState<number | "">("");
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [targetMonth, setTargetMonth] = useState<string>("");
  const [weeklyActuals, setWeeklyActuals] = useState<WeeklyActualRow[]>([]);
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmed, setConfirmed] = useState<null | { store_id: number; dept_id: number; target_month: string; weekCount: number }>(null);
  const [breakdown, setBreakdown] = useState<VarianceBreakdown | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [loadingDepts, startDeptsLoad] = useTransition();
  const [loadingMonths, startMonthsLoad] = useTransition();
  const [loadingWeeks, startWeeksLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [computing, startCompute] = useTransition();

  function resetDownstream(level: "store" | "dept" | "month") {
    if (level === "store") {
      setDepts([]);
      setDeptId("");
    }
    if (level === "store" || level === "dept") {
      setMonths([]);
      setTargetMonth("");
    }
    setWeeklyActuals([]);
    setConfirmed(null);
    setBreakdown(null);
    setBreakdownError(null);
  }

  function handleStoreChange(value: string) {
    const id = value ? Number(value) : "";
    setStoreId(id);
    resetDownstream("store");
    if (!id) return;

    startDeptsLoad(async () => {
      const result = await fetchDepts(id);
      setDepts(result);
    });
  }

  function handleDeptChange(value: string) {
    const id = value ? Number(value) : "";
    setDeptId(id);
    resetDownstream("dept");
    if (!id || storeId === "") return;

    startMonthsLoad(async () => {
      const result = await fetchMonths(storeId as number, id);
      setMonths(result);
    });
  }

  function handleMonthChange(value: string) {
    setTargetMonth(value);
    setWeeklyActuals([]);
    setConfirmed(null);
    if (!value || storeId === "" || deptId === "") return;

    startWeeksLoad(async () => {
      const result = await fetchWeeklyActuals(storeId as number, deptId as number, value);
      setWeeklyActuals(result);
    });
  }

  function updateWeekActual(index: number, rawValue: string) {
    setWeeklyActuals((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, actual_sales: Number(rawValue) } : row
      )
    );
  }

  function updateWeekHoliday(index: number, checked: boolean) {
    setWeeklyActuals((prev) =>
      prev.map((row, i) => (i === index ? { ...row, is_holiday: checked } : row))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmed(null);
    setBreakdown(null);
    setBreakdownError(null);

    const payload = {
      store_id: storeId,
      dept_id: deptId,
      target_month: targetMonth,
      weekly_actuals: weeklyActuals,
      analyst_notes: notes || undefined,
    };

    // Client-side pass: immediate feedback.
    const clientCheck = validateInputForm(payload);
    if (!clientCheck.success) {
      setErrors(clientCheck.errors);
      return;
    }
    setErrors({});

    // Server-side pass: the trust boundary. Never rely on the client check alone.
    startSubmit(async () => {
      const result = await submitInput(payload);
      if (!result.success) {
        setErrors(result.errors);
        return;
      }
      setConfirmed({
        store_id: result.data.store_id,
        dept_id: result.data.dept_id,
        target_month: result.data.target_month,
        weekCount: result.data.weekly_actuals.length,
      });

      // Stage 4: only runs once the input has cleared validation. The
      // deterministic logic layer never sees an unvalidated payload.
      startCompute(async () => {
        const varianceResult = await computeVariance(payload);
        if (!varianceResult.success) {
          setBreakdownError(varianceResult.error);
          return;
        }
        setBreakdown(varianceResult.breakdown);
      });
    });
  }

  const selectedStoreLabel = stores.find((s) => s.store_id === storeId);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Store
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            value={storeId}
            onChange={(e) => handleStoreChange(e.target.value)}
          >
            <option value="">Select a store...</option>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>
                Store {s.store_id} ({s.type ?? "?"}
                {s.region_name ? `, ${s.region_name}` : ""})
              </option>
            ))}
          </select>
          {errors.store_id && (
            <p className="text-xs text-red-600 mt-1">{errors.store_id}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Department
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            value={deptId}
            disabled={storeId === "" || loadingDepts}
            onChange={(e) => handleDeptChange(e.target.value)}
          >
            <option value="">
              {loadingDepts ? "Loading..." : "Select a department..."}
            </option>
            {depts.map((d) => (
              <option key={d} value={d}>
                Dept {d}
              </option>
            ))}
          </select>
          {errors.dept_id && (
            <p className="text-xs text-red-600 mt-1">{errors.dept_id}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Target month
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            value={targetMonth}
            disabled={deptId === "" || loadingMonths}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            <option value="">
              {loadingMonths ? "Loading..." : "Select a month..."}
            </option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {errors.target_month && (
            <p className="text-xs text-red-600 mt-1">{errors.target_month}</p>
          )}
          {deptId !== "" && !loadingMonths && months.length === 0 && targetMonth === "" && (
            <p className="text-xs text-slate-400 mt-1">
              No forecast exists for this store/dept in the May-Oct 2012 window.
            </p>
          )}
        </div>
      </fieldset>

      {loadingWeeks && (
        <p className="text-sm text-slate-500">Loading weekly actuals...</p>
      )}

      {!loadingWeeks && weeklyActuals.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            Edit target period actuals (weekly grain)
            {selectedStoreLabel ? ` -- Store ${selectedStoreLabel.store_id}` : ""}
          </label>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Week</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">
                  Actual sales (USD)
                </th>
                <th className="text-center px-3 py-2 font-semibold text-slate-600">
                  Holiday week
                </th>
              </tr>
            </thead>
            <tbody>
              {weeklyActuals.map((row, i) => (
                <tr key={row.week_date} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-mono text-slate-700">{row.week_date}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full text-right font-mono rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      value={row.actual_sales}
                      onChange={(e) => updateWeekActual(i, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_holiday}
                      onChange={(e) => updateWeekHoliday(i, e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {errors.weekly_actuals && (
            <p className="text-xs text-red-600 mt-1">{errors.weekly_actuals}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Total for period:{" "}
            <span className="font-semibold text-slate-800">
              {currency.format(weeklyActuals.reduce((sum, r) => sum + (Number.isFinite(r.actual_sales) ? r.actual_sales : 0), 0))}
            </span>
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Analyst notes (optional)
        </label>
        <textarea
          rows={4}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Operational conditions, execution notes, or context worth carrying into the explanation -- not used to override the numbers."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {errors.analyst_notes && (
          <p className="text-xs text-red-600 mt-1">{errors.analyst_notes}</p>
        )}
      </div>

      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

      <button
        type="submit"
        disabled={submitting || weeklyActuals.length === 0}
        className="rounded-lg bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? "Validating..." : "Validate input"}
      </button>

      {confirmed && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">✓ Input validated.</p>
          <p className="mt-1 text-emerald-800">
            Store {confirmed.store_id} / Dept {confirmed.dept_id} / {confirmed.target_month} --{" "}
            {confirmed.weekCount} week{confirmed.weekCount === 1 ? "" : "s"} of numeric,
            non-negative actuals passed both client- and server-side validation.
          </p>
          <p className="mt-2 text-emerald-700 text-xs">
            This payload has been handed off to Stage 4 (deterministic logic layer) below. It is
            not persisted to <code>variance_reports</code> yet -- that wiring is Stage 6.
          </p>
        </div>
      )}

      {computing && (
        <p className="text-sm text-slate-500">Running deterministic variance calculation...</p>
      )}

      {breakdownError && (
        <p className="text-sm text-red-600">Stage 4 error: {breakdownError}</p>
      )}

      {breakdown && !computing && <VarianceBreakdownView breakdown={breakdown} />}
    </form>
  );
}
