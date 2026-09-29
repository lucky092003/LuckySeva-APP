-- Pull-request review bot.
-- The `pr-review-bot` edge function receives GitHub webhooks, runs a set of
-- static rules over the changed files and posts a single sticky comment per PR.
--
-- Two tables:
--   pr_review_settings  one row per repository, holds the review preferences the
--                       bot reads on every pull-request event.
--   pr_reviews          one row per review run; the audit trail plus the
--                       post-commit lookup used to decide whether a head SHA has
--                       already been reviewed.
--
-- Neither table stores a secret. The shared webhook secret and the GitHub
-- credentials belong in `supabase secrets` (or Vault), not in a readable table:
-- every policy below is USING (true), so a row-level secret would be readable
-- through the anon key.

CREATE TABLE IF NOT EXISTS pr_review_settings (
  repo_full_name text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  min_severity text NOT NULL DEFAULT 'warning' CHECK (min_severity IN ('info', 'warning', 'blocker')),
  comment_mode text NOT NULL DEFAULT 'sticky' CHECK (comment_mode IN ('sticky', 'new', 'dry_run')),
  rules text[] NOT NULL DEFAULT '{}',
  -- Off by default: a REQUEST_CHANGES review blocks the merge until a human
  -- responds, which is a decision to make deliberately per repository.
  block_on_blocker boolean NOT NULL DEFAULT false,
  last_review_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_review_settings_enabled ON pr_review_settings (enabled) WHERE enabled;

CREATE TABLE IF NOT EXISTS pr_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name text NOT NULL,
  pr_number int NOT NULL,
  head_sha text NOT NULL,
  event text,
  verdict text NOT NULL CHECK (verdict IN ('clean', 'findings', 'error', 'skipped')),
  blocker_count int NOT NULL DEFAULT 0,
  warning_count int NOT NULL DEFAULT 0,
  info_count int NOT NULL DEFAULT 0,
  comment_id bigint,
  comment_url text,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

-- Idempotency: a `synchronize` webhook can arrive more than once for the same
-- commit, and the bot looks this up before doing any work.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_reviews_sha ON pr_reviews (repo_full_name, pr_number, head_sha);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_recent ON pr_reviews (repo_full_name, pr_number, created_at DESC);

ALTER TABLE pr_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_reviews ENABLE ROW LEVEL SECURITY;

-- `pr_reviews` stays service-role only: it is an audit log and nothing in the
-- app reads it from a browser. Granting select to `anon`/`authenticated` would
-- publish the bot's findings to anyone holding the public anon key.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pr_review_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%I" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%I" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%I" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%I" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;
