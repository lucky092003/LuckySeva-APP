-- Remove the PR review bot's storage.
--
-- The pr-review-bot Edge Function was never deployed (its /functions/v1 URL
-- has always 404'd) and never recorded a single run, so all three tables are
-- empty in every environment. The bot and its code are being deleted from the
-- repo in the same change as this migration.
--
-- Data loss note: this explicitly drops empty automation tables. No app data
-- (bookings, payments, profiles, ...) is touched — see the table names.
--
-- luckyseva: destructive-by-design
--
-- Kept as a standalone migration rather than editing the old ones, because
-- migrations are append-only (CI checks filename order and re-applability).

DROP TABLE IF EXISTS changelog_entries;
DROP TABLE IF EXISTS pr_reviews;
DROP TABLE IF EXISTS pr_review_settings;
