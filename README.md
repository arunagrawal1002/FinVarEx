# FinVarEx — Variance Explanation Assistant

Capstone Track 4 (Finance). A deterministic logic layer paired with a language layer, built so a finance analyst can explain a forecast miss in minutes without a model inventing the reason why.

## Hosting

Deployed on **Vercel** (not Replit — Replit's monthly credit + spending cap were exhausted mid-build, so hosting moved to Vercel). Note this is a deliberate deviation from the assignment's stated "Replit" stack line item; the working prototype, GitHub history, and rubric criteria are otherwise built exactly to spec.

- Production URL: https://finvarex.vercel.app
- Vercel project: `finvarex` (team `waypoint5`)
- Redeployed via the Vercel MCP as each stage lands; git-based auto-deploy can be wired up later by importing this repo at vercel.com/new if preferred.

## Status

- [x] Product Brief finalized (`docs/VarEx_Product_Brief.pdf`)
- [x] Supabase project provisioned (`FinVarEx`, project ref `wmovmhilasvzcqvuzbvj`, region `us-east-1`)
- [x] 7-table schema applied (stores, sales_actuals, sales_forecasts, weekly_environmental_context, competitor_intelligence, seasonal_index, variance_reports)
- [x] Vercel deployment pipeline live (placeholder page)
- [x] ETL / seeding
- [x] Structured input form & validation
- [x] Deterministic logic layer
- [x] LLM integration
- [x] Database persistence wiring
- [x] Frontend output + admin dashboard

See `docs/SESSION_HANDOFF.md` for detailed current state and next steps.

## Git commit structure (minimum 6, required)

1. `docs: add product brief documentation`
2. `feat: implement structured data input form and validation`
3. `feat: build deterministic logic layer calculations`
4. `feat: integrate LLM API layer and prompt boundaries`
5. `feat: configure database persistence models`
6. `feat: design visual output panels and admin dashboard`

## Setup

Repo: https://github.com/arunagrawal1002/FinVarEx

Run this from inside the `finvarex` folder (either on your own machine, or after uploading these files into your Replit project's shell):

```bash
git init
git add .
git commit -m "docs: add product brief documentation"
git branch -M main
git remote add origin https://github.com/arunagrawal1002/FinVarEx.git
git push -u origin main
```

If Replit's Git pane is doing the connecting instead, just point it at `https://github.com/arunagrawal1002/FinVarEx` and let Replit handle init/remote — then commit these three files (`README.md`, `.gitignore`, `docs/VarEx_Product_Brief.pdf`) as your first commit with the message above.

## Supabase

- Project URL: `https://wmovmhilasvzcqvuzbvj.supabase.co`
- Get the publishable/anon key from the Supabase dashboard → Project Settings → API, and set it as an environment variable in Replit (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a server-side `SUPABASE_SERVICE_ROLE_KEY` for backend writes — never expose the service role key to the client).
