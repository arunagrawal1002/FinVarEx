-- Enable Row Level Security on all 7 tables with zero anon/authenticated
-- policies. This makes the anon key useless for direct DB access -- every
-- query from the FinVarEx app goes through a server-side client using the
-- service role key (which bypasses RLS), never the anon key from the
-- browser. Addresses the "RLS disabled" advisory flagged since Stage 1.

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_environmental_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variance_reports ENABLE ROW LEVEL SECURITY;
