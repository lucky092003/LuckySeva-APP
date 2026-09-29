import { addedLines, parsePatch, removedLines } from "./diff.ts";
import type {
  ChangedFile,
  DiffLine,
  Finding,
  Hunk,
  ReviewInput,
  ReviewResult,
  Severity,
} from "./types.ts";
import { SEVERITY_ORDER } from "./types.ts";

export interface RuleContext {
  file: ChangedFile;
  hunks: Hunk[];
  added: DiffLine[];
  removed: DiffLine[];
  addedText: string[];
  removedText: string[];
  fullPatch: string;
}

export interface Rule {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  appliesTo(ctx: RuleContext): boolean;
  run(ctx: RuleContext): Finding[];
}

const MIGRATIONS_DIR = /^backend\/supabase\/migrations\/.+\.sql$/;
const ROUTER_PY = /^backend\/app\/routers\/.+\.py$/;
const REQUIREMENTS_TXT = /^backend\/requirements.*\.txt$/;
const MIGRATION_NAME = /^\d{14}_[a-z0-9][a-z0-9_]*\.sql$/;
const TEMPLATE_FILE = /\.(example|sample|template)$/;

// The bot's own source. Its patterns and fixtures contain deliberately fake
// credentials, and a scanner that flags its own rule definitions is noise. Only
// the two credential rules opt out of this; every other rule still runs.
const SELF_PATH = /^backend\/supabase\/functions\/pr-review-bot\//;

function isTestFile(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  return /(^|\/)tests?\//i.test(path) ||
    /[._-](test|spec)\.[a-z]+$/i.test(name) ||
    /^(test|spec)_/i.test(name) ||
    /_(test|spec)$/i.test(name);
}

function context(file: ChangedFile): RuleContext {
  const hunks = parsePatch(file.patch);
  const added = addedLines(hunks);
  const removed = removedLines(hunks);
  return {
    file,
    hunks,
    added,
    removed,
    addedText: added.map((l) => l.text),
    removedText: removed.map((l) => l.text),
    fullPatch: file.patch ?? "",
  };
}

function finding(
  rule: Rule,
  ctx: RuleContext,
  line: number | null,
  message: string,
  hint?: string,
): Finding {
  const base: Finding = {
    rule: rule.id,
    severity: rule.severity,
    path: ctx.file.filename,
    line,
    message,
  };
  return hint === undefined ? base : { ...base, hint };
}

function isEnvRead(text: string): boolean {
  return /os\.getenv|Deno\.env|process\.env|require_env|getenv\(|load_dotenv/.test(text);
}

// `admin123` counts as a placeholder: it is a known default, not a secret, and
// the hardcoded-admin-credentials rule reports it with a better message.
function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.length < 8) return true;
  if (/^[^a-z0-9]*$/.test(v)) return true;
  if (
    /(your|changeme|change-me|placeholder|example|dummy|fake|redacted|xxxx|\.\.\.|todo|admin123)/
      .test(v)
  ) {
    return true;
  }
  return false;
}

// `fuzzy: true` marks a pattern that fires on any quoted literal assigned to a
// credential-shaped name. Those are the ones that turn a repo's own test
// fixtures into blockers, so they are skipped in tests and example files. The
// known-shape patterns have no `fuzzy` flag and are reported everywhere.
const SECRET_PATTERNS: Array<{ re: RegExp; what: string; fuzzy?: boolean }> = [
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, what: "a private key" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{16,}/, what: "a GitHub token" },
  { re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}/, what: "a model provider API key" },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: "an AWS access key id" },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, what: "a signed JWT" },
  {
    re: /SUPABASE_(?:SERVICE_ROLE_KEY|JWT_SECRET)\s*[:=]\s*["']([^"'\n]+)["']/i,
    what: "a Supabase service-role key or JWT secret",
  },
  {
    re:
      /\b(?:api[_-]?key|api[_-]?secret|secret[_-]?key|auth[_-]?token|access[_-]?token|password|passwd)\b\s*[:=]\s*["']([^"'\n]+)["']/i,
    what: "a hardcoded credential",
    fuzzy: true,
  },
];

export const secret: Rule = {
  id: "secret",
  severity: "blocker",
  title: "Secret in the diff",
  description:
    'A credential literal was added. Rotate it if it was ever real. Known-shape tokens (private keys, GitHub/Anthropic/AWS tokens, JWTs, Supabase keys) are reported everywhere; the fuzzy `password = "..."` pattern is skipped in test fixtures and `.example` files, which is where a repo\'s own fakes live.',
  appliesTo: (ctx) => ctx.added.length > 0 && !SELF_PATH.test(ctx.file.filename),
  run(ctx) {
    const lowSignal = TEMPLATE_FILE.test(ctx.file.filename) || isTestFile(ctx.file.filename);
    const out: Finding[] = [];
    const seen = new Set<number>();

    for (const line of ctx.added) {
      if (isEnvRead(line.text)) continue;

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.fuzzy === true && lowSignal) continue;
        const match = pattern.re.exec(line.text);
        if (!match) continue;

        const captured = match[1];
        if (captured !== undefined && isPlaceholder(captured)) continue;
        if (seen.has(line.newLine ?? -1)) continue;
        seen.add(line.newLine ?? -1);

        out.push(
          finding(
            secret,
            ctx,
            line.newLine,
            `Added line looks like it contains ${pattern.what}.`,
            "Remove the literal and read it from the environment. If the value was ever real, rotate it now — it is in this repo's history.",
          ),
        );
        break;
      }
    }
    return out;
  },
};

// Documentation that *describes* a credential is not a credential. The
// `secret` rule still reports known-shape tokens in markdown, because a real
// private key pasted into a README is still a leak.
const CODE_FILE = /\.(?:py|ts|tsx|js|jsx|mjs|cjs|vue|svelte|kt|swift|java|rb|go|php|sql)$/i;

export const hardcodedAdminCredentials: Rule = {
  id: "hardcoded-admin-credentials",
  severity: "blocker",
  title: "Hardcoded admin credentials",
  description:
    "The admin login falls back to a literal username and password. Scoped to code files, since docs/brain.md documents the default on purpose.",
  appliesTo: (ctx) =>
    ctx.added.length > 0 && CODE_FILE.test(ctx.file.filename) &&
    !SELF_PATH.test(ctx.file.filename),
  run(ctx) {
    const out: Finding[] = [];
    for (const line of ctx.added) {
      if (/\badmin123\b/.test(line.text) || /\bADMIN_CREDENTIALS\b\s*[:=]/.test(line.text)) {
        out.push(
          finding(
            hardcodedAdminCredentials,
            ctx,
            line.newLine,
            "Hardcoded admin credential added.",
            "Credentials belong in `admin_settings` / the environment, never in a literal that ships to the bundle.",
          ),
        );
      }
    }
    return out;
  },
};

const DESTRUCTIVE_PATTERNS: Array<{ re: RegExp; what: string }> = [
  { re: /\bDROP\s+TABLE\b/i, what: "DROP TABLE" },
  { re: /\bDROP\s+SCHEMA\b/i, what: "DROP SCHEMA" },
  { re: /\bDROP\s+DATABASE\b/i, what: "DROP DATABASE" },
  // `DROP POLICY` is deliberately absent: every migration in this repo opens
  // each `CREATE POLICY` with `DROP POLICY IF EXISTS`, which is what makes a
  // second apply a no-op. Flagging it would fire on every conforming migration.
  { re: /\bDROP\s+(?:TYPE|FUNCTION|TRIGGER)\b/i, what: "a DROP of a shared object" },
  { re: /\bTRUNCATE\b/i, what: "TRUNCATE" },
  { re: /\bALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN\b/i, what: "a dropped column" },
  { re: /\bDELETE\s+FROM\s+[a-z_][a-z0-9_]*\s*;/i, what: "an unqualified DELETE FROM" },
];

export const destructiveSql: Rule = {
  id: "destructive-sql",
  severity: "blocker",
  title: "Destructive SQL",
  description:
    "The migrations CI job already fails on some of these; this catches them at review time, before the migration reaches master.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".sql") && ctx.added.length > 0,
  run(ctx) {
    const out: Finding[] = [];
    for (const line of ctx.added) {
      for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (!pattern.re.test(line.text)) continue;
        out.push(
          finding(
            destructiveSql,
            ctx,
            line.newLine,
            `Added ${pattern.what}.`,
            "Migrations are applied by hand to the live project. If the data loss is intended, split this out and say so in the PR description.",
          ),
        );
        break;
      }
    }
    return out;
  },
};

export const editedMigration: Rule = {
  id: "edited-migration",
  severity: "warning",
  title: "Existing migration was edited",
  description:
    "Migrations are append-only; editing an applied one leaves environments out of sync.",
  appliesTo: (ctx) =>
    MIGRATIONS_DIR.test(ctx.file.filename) &&
    (ctx.file.status === "modified" || ctx.file.status === "removed"),
  run(ctx) {
    return [
      finding(
        editedMigration,
        ctx,
        null,
        `Migration ${ctx.file.filename.split("/").pop()} was ${
          ctx.file.status === "removed" ? "deleted" : "changed"
        }.`,
        "Add a new timestamped migration instead. Environments that already applied this file will not pick the change up.",
      ),
    ];
  },
};

export const migrationNaming: Rule = {
  id: "migration-naming",
  severity: "warning",
  title: "Migration filename does not follow the convention",
  description:
    "Migrations must be named YYYYMMDDHHMMSS_snake_case.sql, because CI applies them in filename order.",
  appliesTo: (ctx) => MIGRATIONS_DIR.test(ctx.file.filename) && ctx.file.status === "added",
  run(ctx) {
    const name = ctx.file.filename.split("/").pop() ?? "";
    if (MIGRATION_NAME.test(name)) return [];
    return [
      finding(
        migrationNaming,
        ctx,
        null,
        `\`${name}\` is not \`YYYYMMDDHHMMSS_snake_case.sql\`.`,
        "CI sorts the files and applies them in that order, so the timestamp is what determines the sequence.",
      ),
    ];
  },
};

export const rlsMissing: Rule = {
  id: "rls-missing",
  severity: "warning",
  title: "New table without RLS",
  description: "Every table in this schema enables row level security.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".sql") && ctx.file.status === "added",
  run(ctx) {
    const created: Array<{ name: string; line: number | null }> = [];
    const createTable =
      /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;

    for (const line of ctx.added) {
      createTable.lastIndex = 0;
      const match = createTable.exec(line.text);
      if (match) created.push({ name: match[1], line: line.newLine });
    }
    if (created.length === 0) return [];

    // File-scoped, not statement-scoped: migrations 2 and 5 enable RLS from a
    // `DO $$ ... FOREACH t IN ARRAY ...` loop, so matching table name to
    // statement position would report false positives. The cost is the other
    // way round: a file that enables RLS on some tables but not all passes.
    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(ctx.fullPatch)) return [];

    return created.map(({ name, line }) =>
      finding(
        rlsMissing,
        ctx,
        line,
        `\`${name}\` is created and this migration never enables row level security.`,
        "Every other table in this schema enables it. Note the policies here are `USING (true)` — RLS is defence in depth, not the access boundary — but a table with it off is a silent exception.",
      )
    );
  },
};

export const foreignKeyWithoutIndex: Rule = {
  id: "foreign-key-without-index",
  severity: "info",
  title: "Foreign key added without an index",
  description: "Existing migrations pair every REFERENCES column with a CREATE INDEX.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".sql") && ctx.file.status === "added",
  run(ctx) {
    const out: Finding[] = [];
    const addColumn =
      /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+uuid\s+REFERENCES/i;

    for (const line of ctx.added) {
      const match = addColumn.exec(line.text);
      if (!match) continue;
      if (new RegExp(`CREATE\\s+INDEX[\\s\\S]*\\b${match[1]}\\b`, "i").test(ctx.fullPatch)) {
        continue;
      }
      out.push(
        finding(
          foreignKeyWithoutIndex,
          ctx,
          line.newLine,
          `Foreign key \`${match[1]}\` has no index in this migration.`,
          "Matches the pattern of the other migrations, where every FK column gets a `CREATE INDEX IF NOT EXISTS`.",
        ),
      );
    }
    return out;
  },
};

export const routerConvention: Rule = {
  id: "router-convention",
  severity: "warning",
  title: "New router does not follow the db-access convention",
  description: "backend/tests greps every router to enforce a single import shape.",
  appliesTo: (ctx) => ROUTER_PY.test(ctx.file.filename) && ctx.file.status === "added",
  run(ctx) {
    const hasImport = ctx.fullPatch.includes("from ..db import db, one") ||
      ctx.fullPatch.includes("from app.db import db, one");
    if (hasImport) return [];
    return [
      finding(
        routerConvention,
        ctx,
        null,
        "No `from ..db import db, one` import.",
        "`backend/tests/test_maybe_single.py` asserts this import in all five routers, so CI fails without it.",
      ),
    ];
  },
};

// `profiles`, `addresses`, `bookings`, `favourites` and `notifications` are all
// scoped by handler-level filters, because the service role bypasses RLS.
const OWNERSHIP_COLUMNS = new Set([
  "customer_phone",
  "professional_id",
  "phone",
  "role",
]);

const EQ_COLUMN = /\.eq\(\s*["']([a-z_][a-z0-9_]*)["']/g;

function eqColumns(text: string): string[] {
  return [...text.matchAll(EQ_COLUMN)]
    .map((match) => match[1])
    .filter((column) => OWNERSHIP_COLUMNS.has(column));
}

export const ownershipFilterRemoved: Rule = {
  id: "ownership-filter-removed",
  severity: "blocker",
  title: "Row-ownership filter removed",
  description:
    "RLS policies are USING (true) and the backend uses the service role, so these handler filters are the only isolation. Compares removals against additions per column, so a filter that moved to a rewritten line is not reported.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".py") && ctx.removed.length > 0,
  run(ctx) {
    const removed = new Map<string, number[]>();
    const added = new Map<string, number>();

    for (const line of ctx.removed) {
      for (const column of eqColumns(line.text)) {
        const lines = removed.get(column) ?? [];
        lines.push(line.oldLine ?? 0);
        removed.set(column, lines);
      }
    }
    for (const line of ctx.added) {
      for (const column of eqColumns(line.text)) {
        added.set(column, (added.get(column) ?? 0) + 1);
      }
    }

    const out: Finding[] = [];
    for (const [column, lines] of removed) {
      const shortfall = lines.length - (added.get(column) ?? 0);
      if (shortfall <= 0) continue;
      for (const oldLine of lines.slice(0, shortfall)) {
        out.push(
          finding(
            ownershipFilterRemoved,
            ctx,
            oldLine,
            `The \`.eq("${column}", ...)\` row-ownership filter was removed.`,
            "The service role bypasses RLS, so this filter is what stops one customer reading another's rows. Removing it silently widens access for every query in the handler.",
          ),
        );
      }
    }
    return out;
  },
};

const AUTH_GUARDS =
  /\b(?:require_admin|require_customer|require_provider|require_role|get_claims|HTTPBearer|verify_token)\b/;

export const authGuardRemoved: Rule = {
  id: "auth-guard-removed",
  severity: "blocker",
  title: "Authentication guard removed",
  description: "The role guards in app/dependencies.py are the only auth on these routes.",
  appliesTo: (ctx) => ROUTER_PY.test(ctx.file.filename) && ctx.removed.length > 0,
  run(ctx) {
    const out: Finding[] = [];
    for (const line of ctx.removed) {
      if (!AUTH_GUARDS.test(line.text)) continue;
      out.push(
        finding(
          authGuardRemoved,
          ctx,
          line.oldLine,
          "Removed a role guard or token verification.",
          "If this is intentional, the replacement needs a test proving the route is still rejected anonymously — `test_smoke.py` covers the booking routes only.",
        ),
      );
    }
    return out;
  },
};

export const corsWidened: Rule = {
  id: "cors-widened",
  severity: "warning",
  title: "CORS widened",
  description: "Allowing every origin lets any site call the API with the caller's token.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".py") && ctx.added.length > 0,
  run(ctx) {
    const out: Finding[] = [];
    for (const line of ctx.added) {
      if (!/allow_origins\s*=\s*\[\s*["']\*["']\s*\]/.test(line.text)) continue;
      out.push(
        finding(
          corsWidened,
          ctx,
          line.newLine,
          "Wildcard `allow_origins` added.",
          '`main.py` already ships with `["*"]`, so this is not new exposure today, but adding another one multiplies it.',
        ),
      );
    }
    return out;
  },
};

export const unpinnedDependency: Rule = {
  id: "unpinned-dependency",
  severity: "warning",
  title: "Unpinned dependency",
  description: "requirements.txt mixes pinned and floating entries; the new ones should be pinned.",
  appliesTo: (ctx) => REQUIREMENTS_TXT.test(ctx.file.filename) && ctx.added.length > 0,
  run(ctx) {
    const out: Finding[] = [];
    for (const line of ctx.added) {
      const text = line.text.trim();
      if (text === "" || text.startsWith("#") || text.startsWith("-")) continue;
      if (text.includes("==")) continue;
      out.push(
        finding(
          unpinnedDependency,
          ctx,
          line.newLine,
          `\`${text}\` has no version pin.`,
          "`pip-audit` runs in CI against this file, and a floating requirement makes the audit non-reproducible.",
        ),
      );
    }
    return out;
  },
};

const ROUTE_DECORATOR = /@(?:router|app)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;

export const routeOrderRisk: Rule = {
  id: "route-order-risk",
  severity: "info",
  title: "Possible route-order conflict",
  description:
    "FastAPI matches in declaration order, so a `/{id}` route declared above a static sibling shadows it.",
  appliesTo: (ctx) => ctx.file.filename.endsWith(".py") && ctx.added.length > 0,
  run(ctx) {
    const routes: Array<{ path: string; line: number | null }> = [];
    for (const line of ctx.added) {
      ROUTE_DECORATOR.lastIndex = 0;
      const match = ROUTE_DECORATOR.exec(line.text);
      if (match) routes.push({ path: match[2], line: line.newLine });
    }
    if (routes.length < 2) return [];

    const out: Finding[] = [];
    for (let i = 0; i < routes.length; i += 1) {
      for (let j = i + 1; j < routes.length; j += 1) {
        const earlier = routes[i];
        const later = routes[j];
        if (!earlier.path.includes("{")) continue;
        if (later.path.includes("{")) continue;
        if (earlier.path.split("/").length !== later.path.split("/").length) continue;
        out.push(
          finding(
            routeOrderRisk,
            ctx,
            later.line,
            `\`${later.path}\` is declared after \`${earlier.path}\`, which matches the same shape with a path parameter.`,
            "Only a concern when both were added in this diff; the param route will shadow the static one.",
          ),
        );
      }
    }
    return out;
  },
};

export const RULES: Rule[] = [
  secret,
  hardcodedAdminCredentials,
  destructiveSql,
  editedMigration,
  migrationNaming,
  rlsMissing,
  foreignKeyWithoutIndex,
  routerConvention,
  ownershipFilterRemoved,
  authGuardRemoved,
  corsWidened,
  unpinnedDependency,
  routeOrderRisk,
];

const SEVERITY_RANK: Record<Severity, number> = { blocker: 0, warning: 1, info: 2 };

export function checkPrMeta(input: ReviewInput): Finding[] {
  const out: Finding[] = [];
  if ((input.prBody ?? "").trim().length < 20) {
    out.push({
      rule: "pr-description",
      severity: "info",
      path: "PR description",
      line: null,
      message: "PR description is empty or very short.",
      hint:
        "Migrations and auth changes especially need a note on what a reviewer should verify by hand.",
    });
  }
  if (input.files.length === 0) {
    out.push({
      rule: "no-changed-files",
      severity: "info",
      path: "PR",
      line: null,
      message: "GitHub reported no changed files for this pull request.",
    });
  }
  return out;
}

export function review(
  input: ReviewInput,
  options: { minSeverity?: Severity; enabledRules?: string[] } = {},
): ReviewResult {
  const minSeverity = options.minSeverity ?? "info";
  const enabled = options.enabledRules ?? [];
  const minRank = SEVERITY_RANK[minSeverity];
  const active = new Set(
    RULES
      .filter((rule) => enabled.length === 0 || enabled.includes(rule.id))
      .map((rule) => rule.id),
  );

  const findings: Finding[] = checkPrMeta(input);
  const unreadableFiles: string[] = [];

  for (const file of input.files) {
    if (file.patch === null) {
      unreadableFiles.push(file.filename);
      continue;
    }
    const ctx = context(file);
    for (const rule of RULES) {
      if (!active.has(rule.id)) continue;
      if (!rule.appliesTo(ctx)) continue;
      for (const item of rule.run(ctx)) {
        if (SEVERITY_RANK[item.severity] <= minRank) findings.push(item);
      }
    }
  }

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return (a.line ?? 0) - (b.line ?? 0);
  });

  return {
    findings,
    blockerCount: findings.filter((f) => f.severity === "blocker").length,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    infoCount: findings.filter((f) => f.severity === "info").length,
    unreadableFiles,
  };
}

export function verdictOf(result: ReviewResult): "clean" | "findings" {
  return result.findings.length === 0 ? "clean" : "findings";
}

export function formatComment(input: ReviewInput, result: ReviewResult): string {
  const marker = "<!-- luckyseva-pr-review-bot -->";
  const lines: string[] = [marker, "", "## PR review", ""];

  const totals: string[] = [];
  for (const severity of SEVERITY_ORDER) {
    const count = result.findings.filter((f) => f.severity === severity).length;
    if (count > 0) totals.push(`${count} ${severity}${count === 1 ? "" : "s"}`);
  }

  lines.push(
    totals.length === 0
      ? `No findings in the ${input.files.length} changed file(s).`
      : `${totals.join(" · ")} across ${input.files.length} changed file(s).`,
  );
  lines.push("");

  if (result.findings.length === 0) {
    lines.push(
      "Rules run: committed secrets, destructive SQL, migration hygiene, RLS coverage, auth guards, row-ownership filters, and dependency pinning. This is a static pass, not a correctness review — it will not catch logic bugs.",
    );
  }

  for (const severity of SEVERITY_ORDER) {
    const group = result.findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    const title = severity === "blocker"
      ? "Blockers"
      : severity === "warning"
      ? "Warnings"
      : "Notes";
    lines.push(`### ${title}`, "");
    for (const item of group) {
      const rule = RULES.find((r) => r.id === item.rule);
      const location = item.line === null ? item.path : `\`${item.path}:${item.line}\``;
      const label = rule ? `\`${rule.title}\`` : `\`${item.rule}\``;
      lines.push(`- ${label} — ${location}: ${item.message}`);
      if (item.hint) lines.push(`  <sub>${item.hint}</sub>`);
    }
    lines.push("");
  }

  if (result.unreadableFiles.length > 0) {
    const shown = result.unreadableFiles.slice(0, 10).map((f) => `\`${f}\``);
    const extra = result.unreadableFiles.length - shown.length;
    lines.push(
      `<sub>Not scanned (binary, or the diff is too large for GitHub to inline): ${
        shown.join(", ")
      }${extra > 0 ? ` and ${extra} more` : ""}</sub>`,
      "",
    );
  }

  lines.push(
    `<sub>Static analysis of the diff at \`${
      input.headSha.slice(0, 7)
    }\`. Blockers do not fail CI on their own — CI remains the source of truth. Re-run by pushing a new commit.</sub>`,
  );

  return lines.join("\n");
}
