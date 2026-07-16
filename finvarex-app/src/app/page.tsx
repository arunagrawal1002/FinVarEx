import Link from "next/link";

const STATUS: { label: string; done: boolean }[] = [
  { label: "Product Brief finalized", done: true },
  { label: "Supabase schema provisioned (7 tables)", done: true },
  { label: "GitHub repo + Vercel deployment pipeline live", done: true },
  { label: "ETL / seeding (421,570 real sales rows, full fidelity)", done: true },
  { label: "Structured input form & validation", done: true },
  { label: "Deterministic logic layer", done: true },
  { label: "LLM integration", done: true },
  { label: "Database persistence wiring", done: true },
  { label: "Frontend output + admin dashboard", done: true },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FinVarEx</h1>
          <p className="mt-2 text-slate-600">
            Variance Explanation Assistant — Capstone Track 4 (Finance)
          </p>
        </div>

        <p className="text-sm text-slate-600">
          A deterministic logic layer paired with a language layer, so a finance
          analyst can explain a forecast miss without a model inventing the
          reason why.
        </p>

        <ul className="space-y-2">
          {STATUS.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className={s.done ? "text-emerald-600" : "text-slate-300"}>
                {s.done ? "✓" : "○"}
              </span>
              <span className={s.done ? "text-slate-800" : "text-slate-400"}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/input"
            className="rounded-lg bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-slate-700"
          >
            Open structured input form
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 text-sm font-semibold px-5 py-2.5 hover:bg-slate-100"
          >
            Reports dashboard
          </Link>
          <a
            href="https://github.com/arunagrawal1002/FinVarEx"
            className="rounded-lg border border-slate-300 text-sm font-semibold px-5 py-2.5 hover:bg-slate-100"
          >
            GitHub repo
          </a>
        </div>
      </div>
    </main>
  );
}
