-- Date-wise changelog entries for the review bot.
--
-- When a pull request is opened the bot stores one row here, then regenerates a
-- marked block at the top of CHANGELOG.md and pushes it on a dedicated branch.
--
-- The table is the source of truth for the generated block: the file is rewritten
-- from these rows every run, so a re-fired webhook or a hand-edited branch both
-- converge. The UNIQUE index on (repo, pr_number) is what makes that idempotent.
--
-- Entries are written on `opened`, so a PR that is later closed without merging
-- still appears. That is the intended trade-off, not an oversight.

-- Per-repo controls for the changelog half of the bot, alongside the review ones.
ALTER TABLE pr_review_settings
  ADD COLUMN IF NOT EXISTS changelog_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE pr_review_settings
  ADD COLUMN IF NOT EXISTS changelog_branch text NOT NULL DEFAULT 'luckyseva/changelog';
ALTER TABLE pr_review_settings
  ADD COLUMN IF NOT EXISTS changelog_file text NOT NULL DEFAULT 'CHANGELOG.md';
ALTER TABLE pr_review_settings
  ADD COLUMN IF NOT EXISTS last_changelog_at timestamptz;

-- One run row per webhook covers both halves of the bot, so the changelog outcome
-- lives next to the review verdict instead of in a table of its own.
ALTER TABLE pr_reviews
  ADD COLUMN IF NOT EXISTS changelog_status text
  CHECK (changelog_status IS NULL OR changelog_status IN ('ok', 'unchanged', 'disabled', 'error'));
ALTER TABLE pr_reviews
  ADD COLUMN IF NOT EXISTS changelog_pr_url text;

CREATE TABLE IF NOT EXISTS changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name text NOT NULL,
  pr_number int NOT NULL,
  pr_title text NOT NULL,
  pr_author text,
  pr_url text,
  kind text NOT NULL CHECK (kind IN ('added', 'changed', 'fixed')),
  entry_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_changelog_entries_pr ON changelog_entries (repo_full_name, pr_number);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_date ON changelog_entries (repo_full_name, entry_date DESC);

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: the generated block is a public artifact (it
-- lives in a committed file), so there is nothing here for a browser to read,
-- and the service role is the only writer.
