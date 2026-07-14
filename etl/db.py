"""
Shared DB connection helper for the FinVarEx ETL scripts.

Set the DATABASE_URL environment variable before running anything in this
folder. Get the connection string from the Supabase dashboard:
  Project (FinVarEx, ref wmovmhilasvzcqvuzbvj) -> Settings -> Database
  -> Connection string -> URI (use the "Session pooler" variant if your
  network blocks direct Postgres connections, e.g. on some coffee-shop wifi
  or certain Replit configurations).

In Replit: put it in the Secrets pane as DATABASE_URL.
Locally: export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.wmovmhilasvzcqvuzbvj.supabase.co:5432/postgres"
"""
import os
import sys
import psycopg2


def get_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "DATABASE_URL is not set. Grab the connection string from the "
            "Supabase dashboard (Settings -> Database -> Connection string) "
            "and set it as an environment variable / Replit secret first."
        )
    return psycopg2.connect(url)
