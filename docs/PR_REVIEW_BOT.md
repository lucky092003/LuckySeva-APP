# PR review bot and changelog

`backend/supabase/functions/pr-review-bot/` is a Supabase Edge Function that
reviews pull requests and maintains `CHANGELOG.md`. It runs a fixed set of
static rules over the diff and posts a single comment per PR — no LLM, no API
key, no per-PR cost. Every rule is a pure function over the patch, so the same
PR always gets the same review.

The rules are specific to this repo, not generic style advice:

| Severity | Rule | Why it exists here |
|---|---|---|
| blocker | `secret` | Supabase service-role key, JWT, private key, GitHub/model/AWS token literals |
| blocker | `hardcoded-admin-credentials` | The admin login has a literal fallback |
| blocker | `destructive-sql` | Mirrors the CI grep, so it lands before `master` |
| blocker | `ownership-filter-removed` | RLS is `USING (true)` and the backend uses the service role, so handler-level `.eq("customer_phone", ...)` is the access boundary |
| blocker | `auth-guard-removed` | Same reasoning for `require_admin` / `require_customer` |
| warning | `edited-migration` | Migrations are append-only; editing an applied one desyncs environments |
| warning | `migration-naming` | CI applies migrations in filename order, so the timestamp is the sequence |
| warning | `rls-missing` | Every table in this schema enables RLS |
| warning | `router-convention` | `test_maybe_single.py` greps all five routers for `from ..db import db, one` |
| warning | `cors-widened` | `allow_origins=["*"]` is a live wildcard in `main.py` already |
| warning | `unpinned-dependency` | `pip-audit` runs against `requirements.txt` in CI |
| info | `foreign-key-without-index` | Every other migration pairs a `REFERENCES` column with an index |
| info | `route-order-risk` | FastAPI matches routes in declaration order, so a broad route declared first shadows a specific one |

The function edits its own comment on each new push, so a PR never accumulates
more than one. Drafts are skipped, and a `(repo, pr, head_sha)` unique index
makes a replayed `synchronize` webhook a no-op.

## Setup

Apply the migrations, then set the secrets and deploy:

```sh
cd backend
npx supabase db push                          # pr_review_settings, pr_reviews, changelog_entries
npx supabase secrets set \
  GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  GITHUB_APP_ID="<app id>" \
  GITHUB_APP_PRIVATE_KEY="$(cat private-key.pem)"
npx supabase functions deploy pr-review-bot
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions
automatically — do not set them by hand.

Then in the GitHub App's settings, add a **Repository webhook**:

| Field | Value |
|---|---|
| Payload URL | `https://<project-ref>.supabase.co/functions/v1/pr-review-bot` |
| Content type | `application/json` |
| Secret | the same `GITHUB_WEBHOOK_SECRET` |
| Events | **Pull request** (individual) |

The App needs read access to pull requests and contents, plus write access to
pull requests (to post the comment and open the changelog PR). With a personal
access token instead of an App, set `GITHUB_TOKEN` with `repo` scope; the
function falls back to it when the payload carries no `installation`.

## Per-repo settings

One row in `pr_review_settings` per repository, created automatically on the
first review or when the App is installed:

| Column | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set `false` to mute the bot for a repo |
| `min_severity` | `warning` | Lowest severity that gets reported (`info` shows everything) |
| `comment_mode` | `sticky` | `sticky` edits one comment, `new` posts a new one each push, `dry_run` posts nothing |
| `rules` | `{}` | Empty means all rules. Otherwise an allowlist of rule ids |
| `block_on_blocker` | `false` | `true` also files a `REQUEST_CHANGES` review, which blocks the merge until a human responds |
| `changelog_enabled` | `true` | `false` leaves `CHANGELOG.md` alone entirely |
| `changelog_branch` | `luckyseva/changelog` | Branch the bot commits to and opens its PR from |
| `changelog_file` | `CHANGELOG.md` | File it rewrites |

Run history lands in `pr_reviews` (service-role only, no anon policies) — one
row per webhook, with the findings as JSON plus `changelog_status` and
`changelog_pr_url`.

```sql
update pr_review_settings set min_severity = 'info' where repo_full_name = 'lucky092003/LuckySeva-APP';
```

## Date-wise changelog

`CHANGELOG.md` is dated, newest section first, with a `**Last updated:** <date>`
line directly under the title. Hand-written entries follow the same shape:
`## YYYY-MM-DD`, then `### Added` / `### Changed` / `### Fixed`. The bot keeps
the header date in step with the newest entry, so a hand-written section never
has to touch it.

When a pull request is **opened**, the bot records it in `changelog_entries`,
regenerates a dated block at the top of `CHANGELOG.md`, and opens (or updates)
a single PR for it. Within each date, entries are grouped into `Added` /
`Changed` / `Fixed` from the conventional-commit prefix on the PR title:

| Title prefix | Bucket |
|---|---|
| `feat:`, `feature:`, `feat!:`, `feat(scope):` | Added |
| `fix:`, `bugfix:`, `hotfix:` | Fixed |
| everything else, including no prefix | Changed |

The prefix is stripped from the rendered line, since the bucket already says
it, and the result is capitalised:

```markdown
## 2026-09-30

### Added

- [#34](https://github.com/lucky092003/LuckySeva-App/pull/34) Share the AddressForm between booking and saved addresses — @lucky092003

### Fixed

- [#35](https://github.com/lucky092003/LuckySeva-App/pull/35) Deleting your default address left you with none — @lucky092003
```

**Only the block between the two markers is machine-written**, apart from one
line: the bot also rewrites the `**Last updated:** <date>` line directly under
`# Changelog` so it always matches the newest entry. Everything else is yours,
so your own dated sections (`## YYYY-MM-DD`, newest first) are safe:

```markdown
<!-- luckyseva-changelog:start -->
...generated...
<!-- luckyseva-changelog:end -->
```

How the loop stays safe to re-run:

- Entries live in `changelog_entries`, so the file is rebuilt from the table
  each time rather than patched. A branch you edited by hand gets corrected,
  not compounded.
- `UNIQUE (repo_full_name, pr_number)` means a replayed `opened` webhook — or
  a PR that was drafted and then marked ready — produces one entry.
- The date comes from the PR's `created_at` in UTC, so a webhook replayed
  tomorrow still lands under the day the PR was opened.
- If the regenerated block matches what is already on the branch, the bot
  writes nothing and does not open a second PR.
- The bot PR is reused: it looks for an open PR from `changelog_branch` and
  pushes to it rather than filing a new one per merged PR.

Trade-off: entries are written on **opened**, not on merge, so a PR closed
without merging still gets listed. That is deliberate — it keeps the entry
visible while work is in flight. Set `changelog_enabled = false` to opt out.

Because the entry text is the PR title, a good title pays off. `fix: deleting
your default address left you with none` reads better in a changelog than
`fix more working`.

## Trying rules locally

The rules are pure, so you can point them at any diff without deploying:

```sh
cd backend/supabase/functions
deno task review HEAD          # review uncommitted work
deno task review main...mybranch
```

The changelog renderer is pure too, so you can preview a block:

```ts
import { applyBlock, classifyTitle, renderBlock } from "./pr-review-bot/changelog.ts";

const block = renderBlock([{
  pr_number: 34,
  pr_title: "feat(ui): share the AddressForm",
  pr_author: "lucky092003",
  pr_url: "https://github.com/lucky092003/LuckySeva-App/pull/34",
  kind: classifyTitle("feat(ui): share the AddressForm"),
  entry_date: "2026-09-30",
}]);
console.log(applyBlock(await Deno.readTextFile("CHANGELOG.md"), block));
```

Each rule is one entry in the `RULES` array in `checks.ts`; add a `Rule` and a
test in `checks_test.ts` and CI will hold it to the same standard as the rest.
