import Link from "next/link";
import { getStores } from "@/lib/queries";
import InputForm from "./InputForm";

// Always hit Supabase fresh -- this is a live analyst tool, not a static page.
export const dynamic = "force-dynamic";

export default async function InputPage() {
  const stores = await getStores();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            Structured Input Form
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick a store, department, and target month. Actuals pre-fill from
            the seeded Kaggle data and are editable before validation.
          </p>
        </div>

        <InputForm stores={stores} />
      </div>
    </main>
  );
}
