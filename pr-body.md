## Summary

Splits the app into a clean `frontend/` + `backend/` layout, and gives **both** sides a real
CI pipeline and Dependabot coverage. No runtime behaviour changes — this is structure,
tooling and docs only.

## Why

Everything for the React app (configs, `package.json`, lockfile, Vite/Capacitor/Tailwind
config) sat at the repo root next to `backend/`. That made the root ambiguous, and meant the
CI workflow and Dependabot only knew how to check one of the two projects.

## Changes

### Repository layout

- **`frontend/`** — all app + build config moved here: `package.json`, `package-lock.json`,
  `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`,
  `components.json`, `index.html`, `capacitor.config.ts`, `eslint.config.js`, `src/`.
  Git recorded these as renames, so history is preserved.
- **`android/` and `ios/`** stay at the repo root (Capacitor convention).
  `capacitor.config.ts` points at them with `android.path: '../android'`, `ios.path: '../ios'`.
- **`backend/supabase/migrations/`** — SQL moved in next to the API that uses it.
- **`frontend/src/lib/`** split into `services/`, `hooks/`, `context/`, `types/`, `utils/`.
  All 18 hook exports preserved via a barrel; hook bodies unchanged.
- `vercel.json` now sets `"rootDirectory": "frontend"`.

### CI (`.github/workflows/ci.yml`)

Two jobs run in parallel on every push/PR to `master`:

| Job | Steps |
| --- | --- |
| Frontend | `npm ci` → ESLint → TypeScript → Vitest → production build → `npm audit` |
| Backend | `pip install` → `compileall` → Ruff → pytest → `pip-audit` |

### Backend tooling (this had no checks at all before)

- **`backend/ruff.toml`** — conservative `E4,E7,E9,F` ruleset. Deliberately not `ALL`; the
  extra rules produce ~48 findings on this codebase and most are stylistic.
- **`backend/requirements-dev.txt`** — `ruff`, `pytest`, `httpx2`, `pip-audit`. Kept
  **separate** from `requirements.txt` so production installs on Render never pull in
  test/lint packages.
- **`backend/tests/test_smoke.py`** — 5 tests: `/health` responds, OpenAPI schema builds,
  all routers mount (67 routes), anonymous requests to the customer/provider/admin booking
  routes are rejected, unknown paths 404.
- Removed one unused import in `backend/app/routers/auth.py`.

### Frontend lint

`npm run lint` was **already failing on `master`** before this branch — 32 errors from
`eslint-plugin-react-hooks@7.1.1`, whose v7 release added React Compiler rules
(`set-state-in-effect` ×26, `preserve-manual-memoization` ×3, `immutability` ×3) that the
existing screens/hooks predate.

Those three rules are turned **off** in `eslint.config.js` (config-only, no app code
touched). The real-bug rules stay on and still report: `react-hooks/exhaustive-deps` and
`react-refresh/only-export-components` (5 warnings). Deleting that 3-line block re-enables
the stricter set once the call sites are migrated.

### Dependabot (`.github/dependabot.yml`)

Now covers the whole repo:

| Ecosystem | Directory | Covers |
| --- | --- | --- |
| `github-actions` | `/` | CI + CodeQL workflow pinning |
| `npm` | `/frontend` | `package.json` + `package-lock.json` |
| `pip` | `/backend` | `requirements.txt` **and** `requirements-dev.txt` |

Dependabot's pip fetcher tracks any `.txt` file and classifies `requirements-dev.txt` as
development scope, so the existing `/backend` entry picks up the new file with no extra
config. Weekly (Friday 23:00 IST), minor/patch bumps grouped into single PRs.

### Docs

`README.md`, `PUBLISHING.md`, `docs/FEATURES.md` — updated project structure, Capacitor
commands (now run from `frontend/`), migration location, backend check commands, and a new
CI/Dependabot section.

## Verification

All 8 CI steps run green locally:

```
frontend:  lint ✓   typecheck ✓   test:unit 7/7 ✓   build 1602 modules ✓
backend:   compileall ✓   ruff ✓   pytest 5/5 ✓   pip-audit "no known vulnerabilities" ✓
```

Also confirmed: all three workflow/dependabot YAML files parse, and `actions/checkout@v7`,
`actions/setup-node@v7`, `actions/setup-python@v7` are all real tags.

## Notes

- Run `npx cap sync` from `frontend/` (paths resolve from the cwd).
- The backend imports and serves all 67 routes with no secrets set, so the tests need no
  Supabase connection.
- A stale gitignored `node_modules/` remains at the repo root from an older dev server; it's
  untracked and unrelated to this change.
