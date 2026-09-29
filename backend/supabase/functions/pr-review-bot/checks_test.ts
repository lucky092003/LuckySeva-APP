import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { formatComment, review, RULES, verdictOf } from "./checks.ts";
import type { ChangedFile, Finding, ReviewInput } from "./types.ts";

function input(
  files: ChangedFile[],
  overrides: Partial<ReviewInput> = {},
): ReviewInput {
  return {
    repoFullName: "lucky092003/LuckySeva-APP",
    prNumber: 7,
    headSha: "a".repeat(40),
    prBody: "A sufficiently long description that does not trip the meta rule.",
    files,
    ...overrides,
  };
}

function file(
  filename: string,
  patch: string | null,
  status: ChangedFile["status"] = "modified",
): ChangedFile {
  return { filename, status, additions: 10, deletions: 2, patch };
}

function rulesFor(findings: Finding[]): string[] {
  return [...new Set(findings.map((f) => f.rule))];
}

function ruleIdsOf(file: ChangedFile): string[] {
  return rulesFor(review(input([file])).findings);
}

Deno.test("a real service-role key on an added line is a blocker", () => {
  const findings = review(input([
    file(
      "backend/app/config.py",
      '@@ -1,1 +1,2 @@\n+SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrstuv"\n',
    ),
  ])).findings;
  assertEquals(findings.length, 1);
  assertEquals(findings[0].rule, "secret");
  assertEquals(findings[0].severity, "blocker");
  assertEquals(findings[0].line, 1);
});

Deno.test("a removed service-role key is still reported, because history keeps it", () => {
  const findings = review(input([
    file(
      "backend/app/config.py",
      '@@ -1,1 +1,0 @@\n-SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrstuv"',
    ),
  ])).findings;
  assertEquals(findings.filter((f) => f.rule === "secret").length, 0);
});

Deno.test("a deleted GitHub token is caught on the removal", () => {
  const findings = review(input([
    file(
      "scripts/push.sh",
      "@@ -1,2 +1,0 @@\n-GH_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123\n",
      "removed",
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("secret"), false);
});

Deno.test("env lookups and placeholders are not secrets", () => {
  const patch = [
    "@@ -1,3 +1,5 @@",
    '+SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")',
    '+api_key = "your-api-key-here"',
    '+password = os.getenv("ADMIN_PASSWORD")',
    '+token = Deno.env.get("GITHUB_TOKEN") ?? ""',
  ].join("\n");
  assertEquals(ruleIdsOf(file("backend/app/config.py", patch)).includes("secret"), false);
});

Deno.test("example files skip the noisy credential pattern but not a private key", () => {
  assertEquals(
    ruleIdsOf(file("backend/.env.example", '@@ -1,1 +1,2 @@\n+API_KEY = "abcdef123456"\n'))
      .includes(
        "secret",
      ),
    false,
  );
  assertEquals(
    ruleIdsOf(
      file("backend/.env.example", "@@ -1,1 +1,2 @@\n+KEY=-----BEGIN RSA PRIVATE KEY-----\n"),
    ).includes("secret"),
    true,
  );
});

Deno.test("test fixtures skip the fuzzy credential pattern but not a known-shape token", () => {
  const fuzzy = '@@ -1,1 +1,2 @@\n+const PASSWORD = "hunter2000";\n';
  for (
    const path of [
      "backend/tests/test_smoke.py",
      "backend/app/routers/foo_test.py",
      "frontend/src/foo.test.ts",
      "frontend/src/foo.spec.ts",
    ]
  ) {
    assertEquals(ruleIdsOf(file(path, fuzzy)).includes("secret"), false, `flagged ${path}`);
  }

  const shaped = '@@ -1,1 +1,2 @@\n+const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123";\n';
  assertEquals(
    ruleIdsOf(file("backend/tests/test_smoke.py", shaped)).includes("secret"),
    true,
    "a real token shape in a test must still be reported",
  );
});

Deno.test("the bot does not flag its own rule definitions", () => {
  const own = "backend/supabase/functions/pr-review-bot/checks.ts";
  const patch =
    '@@ -70,2 +70,3 @@\n+  /(your|changeme|admin123)/\n+const ADMIN_CREDENTIALS = { password: "admin123" };\n';
  assertEquals(ruleIdsOf(file(own, patch, "modified")).includes("secret"), false);
  assertEquals(
    ruleIdsOf(file(own, patch, "modified")).includes("hardcoded-admin-credentials"),
    false,
  );
});

Deno.test("other rules still run on the bot's own source", () => {
  const findings = review(input([
    file(
      "backend/supabase/functions/pr-review-bot/notes.py",
      '@@ -1,1 +1,2 @@\n+    allow_origins=["*"],\n',
      "modified",
    ),
  ])).findings;
  assertEquals(findings.some((f) => f.rule === "cors-widened"), true);
});

Deno.test("DROP POLICY is the repo's idempotency idiom, not a finding", () => {
  const findings = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      [
        "@@ -0,0 +1,3 @@",
        "+DO $$",
        "+  EXECUTE format('DROP POLICY IF EXISTS \"anon_select_x\" ON x');",
        "+END $$;",
      ].join("\n"),
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("destructive-sql"), false);
});

Deno.test("DROP TABLE alongside a DROP POLICY is still reported", () => {
  const findings = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      [
        "@@ -0,0 +1,2 @@",
        "+EXECUTE format('DROP POLICY IF EXISTS \"anon_select_x\" ON x');",
        "+DROP TABLE x;",
      ].join("\n"),
      "added",
    ),
  ])).findings;
  assertEquals(findings.some((f) => f.rule === "destructive-sql"), true);
});

Deno.test("the hardcoded admin password is a blocker", () => {
  const findings = review(input([
    file(
      "frontend/src/lib/app-context.tsx",
      '@@ -1,1 +1,2 @@\n+const ADMIN_CREDENTIALS = { password: "admin123" };',
    ),
  ])).findings;
  assertEquals(findings[0].rule, "hardcoded-admin-credentials");
  assertEquals(findings[0].severity, "blocker");
});

Deno.test("docs describing the default admin password are not findings", () => {
  for (const path of ["docs/brain.md", "README.md", "docs/FEATURES.md"]) {
    assertEquals(
      ruleIdsOf(
        file(path, "@@ -340,1 +340,1 @@\n+It falls back to `admin` / `admin123`.\n", "modified"),
      ).includes("hardcoded-admin-credentials"),
      false,
      `flagged ${path}`,
    );
  }
});

Deno.test("a real key pasted into a doc is still a secret", () => {
  assertEquals(
    ruleIdsOf(
      file("docs/setup.md", "@@ -1,1 +1,2 @@\n+KEY=-----BEGIN RSA PRIVATE KEY-----\n", "modified"),
    ).includes("secret"),
    true,
  );
});

Deno.test("destructive SQL is a blocker and mirrors the CI grep", () => {
  for (const line of ["DROP TABLE bookings;", "TRUNCATE reviews;", "DROP SCHEMA public CASCADE;"]) {
    const findings = review(input([
      file(
        "backend/supabase/migrations/20260930000000_x.sql",
        `@@ -1,1 +1,2 @@\n+${line}\n`,
        "added",
      ),
    ])).findings;
    assertEquals(findings[0].rule, "destructive-sql", `missed: ${line}`);
    assertEquals(findings[0].severity, "blocker");
  }
});

Deno.test("an unqualified DELETE FROM is destructive, a filtered one is not", () => {
  const destructive = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      "@@ -1,1 +1,2 @@\n+DELETE FROM notifications;\n",
      "added",
    ),
  ])).findings;
  assertEquals(destructive[0].rule, "destructive-sql");

  const safe = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      "@@ -1,1 +1,2 @@\n+DELETE FROM notifications WHERE id = 1;\n",
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(safe).includes("destructive-sql"), false);
});

Deno.test("editing an applied migration is a warning", () => {
  const findings = review(input([
    file(
      "backend/supabase/migrations/20260830093336_luckyseva_schema.sql",
      "@@ -1,1 +1,2 @@\n+ALTER TABLE bookings DROP COLUMN notes;\n",
      "modified",
    ),
  ])).findings;
  const edited = findings.find((f) => f.rule === "edited-migration");
  assert(edited !== undefined);
  assertEquals(edited.severity, "warning");
});

Deno.test("a badly named migration is flagged", () => {
  const findings = review(input([
    file("backend/supabase/migrations/add_stuff.sql", "@@ -1,1 +1,2 @@\n+SELECT 1;\n", "added"),
  ])).findings;
  assertEquals(findings[0].rule, "migration-naming");
});

Deno.test("a correctly named migration is not flagged", () => {
  const findings = review(input([
    file(
      "backend/supabase/migrations/20260930010101_add_stuff.sql",
      "@@ -1,1 +1,2 @@\n+SELECT 1;\n",
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("migration-naming"), false);
});

Deno.test("a new table without RLS is flagged, and with RLS is not", () => {
  const withoutRls = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      "@@ -0,0 +1,2 @@\n+CREATE TABLE IF NOT EXISTS booking_notes (id uuid PRIMARY KEY);\n",
      "added",
    ),
  ])).findings;
  assertEquals(withoutRls[0].rule, "rls-missing");
  assertStringIncludes(withoutRls[0].message, "booking_notes");

  const withRls = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      [
        "@@ -0,0 +1,3 @@",
        "+CREATE TABLE IF NOT EXISTS booking_notes (id uuid PRIMARY KEY);",
        "+ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;",
      ].join("\n"),
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(withRls).includes("rls-missing"), false);
});

Deno.test("an indexed foreign key does not get the index note", () => {
  const withoutIndex = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      "@@ -0,0 +1,1 @@\n+ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES slots(id);\n",
      "added",
    ),
  ])).findings;
  assertEquals(withoutIndex[0].rule, "foreign-key-without-index");
  assertEquals(withoutIndex[0].severity, "info");

  const withIndex = review(input([
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      [
        "@@ -0,0 +1,2 @@",
        "+ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES slots(id);",
        "+CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);",
      ].join("\n"),
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(withIndex).includes("foreign-key-without-index"), false);
});

Deno.test("a new router without the db import fails the way CI would", () => {
  const findings = review(input([
    file(
      "backend/app/routers/payouts.py",
      "@@ -0,0 +1,2 @@\n+from fastapi import APIRouter\n+\n",
      "added",
    ),
  ])).findings;
  assertEquals(findings[0].rule, "router-convention");

  const compliant = review(input([
    file(
      "backend/app/routers/payouts.py",
      "@@ -0,0 +1,2 @@\n+from ..db import db, one\n+\n",
      "added",
    ),
  ])).findings;
  assertEquals(rulesFor(compliant).includes("router-convention"), false);
});

Deno.test("removing a row-ownership filter is a blocker", () => {
  const findings = review(input([
    file(
      "backend/app/routers/customer.py",
      '@@ -40,7 +40,6 @@\n-        .eq("customer_phone", claims["phone"])\n         .order("created_at", desc=True)\n',
    ),
  ])).findings;
  const ownership = findings.filter((f) => f.rule === "ownership-filter-removed");
  assertEquals(ownership.length, 1);
  assertEquals(ownership[0].severity, "blocker");
  assertEquals(ownership[0].line, 40);
});

Deno.test("a filter that moved onto a rewritten line is not a removal", () => {
  const findings = review(input([
    file(
      "backend/app/routers/customer.py",
      [
        "@@ -15,2 +15,2 @@",
        '-    res = client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute()',
        '+    return one(client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute())',
      ].join("\n"),
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("ownership-filter-removed"), false);
});

Deno.test("one filter surviving does not excuse a second being dropped", () => {
  const findings = review(input([
    file(
      "backend/app/routers/customer.py",
      [
        "@@ -15,4 +15,4 @@",
        '-    a = db().table("profiles").select("*").eq("phone", p)',
        '-    b = db().table("bookings").select("*").eq("customer_phone", p)',
        '+    a = one(db().table("profiles").select("*").eq("phone", p))',
        '+    b = one(db().table("bookings").select("*"))',
      ].join("\n"),
    ),
  ])).findings;
  const ownership = findings.filter((f) => f.rule === "ownership-filter-removed");
  assertEquals(ownership.length, 1);
  assertStringIncludes(ownership[0].message, "customer_phone");
});

Deno.test("removing a non-ownership filter is not reported", () => {
  const findings = review(input([
    file(
      "backend/app/routers/customer.py",
      '@@ -40,7 +40,6 @@\n-        .eq("status", "pending")\n         .order("created_at", desc=True)\n',
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("ownership-filter-removed"), false);
});

Deno.test("removing a role guard is a blocker", () => {
  const findings = review(input([
    file("backend/app/routers/admin.py", "@@ -12,1 +12,0 @@\n-    require_admin(claims)\n"),
  ])).findings;
  assertEquals(
    findings.some((f) => f.rule === "auth-guard-removed" && f.severity === "blocker"),
    true,
  );
});

Deno.test("an added wildcard CORS origin is flagged", () => {
  const findings = review(input([
    file("backend/app/main.py", '@@ -8,1 +8,2 @@\n+        allow_origins=["*"],\n'),
  ])).findings;
  assertEquals(findings[0].rule, "cors-widened");
});

Deno.test("an unpinned requirement is flagged and a pinned one is not", () => {
  const unpinned = review(input([
    file("backend/requirements.txt", "@@ -1,2 +1,3 @@\n+httpx\n fastapi\n", "modified"),
  ])).findings;
  assertEquals(unpinned[0].rule, "unpinned-dependency");
  assertEquals(unpinned[0].line, 1);

  const pinned = review(input([
    file("backend/requirements.txt", "@@ -1,2 +1,3 @@\n+httpx==0.28.1\n", "modified"),
  ])).findings;
  assertEquals(rulesFor(pinned).includes("unpinned-dependency"), false);
});

Deno.test("a path-param route declared before a static sibling is noted", () => {
  const findings = review(input([
    file(
      "backend/app/routers/provider.py",
      [
        "@@ -20,1 +20,4 @@",
        '+@router.get("/{booking_id}")',
        "+async def one(booking_id: str): ...",
        '+@router.get("/summary")',
        "+async def summary(): ...",
      ].join("\n"),
    ),
  ])).findings;
  const order = findings.filter((f) => f.rule === "route-order-risk");
  assertEquals(order.length, 1);
  assertEquals(order[0].severity, "info");
  assertStringIncludes(order[0].message, "/summary");
});

Deno.test("static routes declared before the param route are fine", () => {
  const findings = review(input([
    file(
      "backend/app/routers/provider.py",
      [
        "@@ -20,1 +20,4 @@",
        '+@router.get("/summary")',
        "+async def summary(): ...",
        '+@router.get("/{booking_id}")',
        "+async def one(booking_id: str): ...",
      ].join("\n"),
    ),
  ])).findings;
  assertEquals(rulesFor(findings).includes("route-order-risk"), false);
});

Deno.test("a binary file is listed as unscanned rather than silently skipped", () => {
  const result = review(input([file("android/app/icon.png", null)]));
  assertEquals(result.unreadableFiles, ["android/app/icon.png"]);
  assertEquals(result.findings.length, 0);
});

Deno.test("minSeverity filters the result", () => {
  const files = [
    file(
      "backend/app/routers/customer.py",
      '@@ -40,1 +40,0 @@\n-        .eq("customer_phone", claims["phone"])\n',
    ),
  ];
  assertEquals(review(input(files), { minSeverity: "info" }).findings.length > 0, true);
  assertEquals(review(input(files), { minSeverity: "blocker" }).findings.length, 1);
});

Deno.test("an explicit rules allowlist narrows the result", () => {
  const files = [
    file(
      "backend/supabase/migrations/20260930000000_x.sql",
      "@@ -0,0 +1,1 @@\n+SELECT 1;\n",
      "added",
    ),
    file("backend/requirements.txt", "@@ -1,1 +1,2 @@\n+httpx\n", "modified"),
  ];
  const onlyNaming = review(input(files), {
    minSeverity: "info",
    enabledRules: ["migration-naming"],
  });
  assertEquals(onlyNaming.findings.every((f) => f.rule === "migration-naming"), true);
});

Deno.test("findings sort by severity, then path, then line", () => {
  const files = [
    file("backend/requirements.txt", "@@ -1,1 +1,3 @@\n+httpx\n+httpx2\n", "modified"),
    file("backend/app/routers/admin.py", "@@ -12,1 +12,0 @@\n-    require_admin(claims)\n"),
  ];
  const severities = review(input(files), { minSeverity: "info" }).findings.map((f) => f.severity);
  const rank = { blocker: 0, warning: 1, info: 2 } as const;
  const ranks = severities.map((s) => rank[s]);
  assertEquals(ranks, [...ranks].sort((a, b) => a - b));
});

Deno.test("verdict is clean only when nothing fired", () => {
  assertEquals(
    verdictOf(review(input([file("README.md", "@@ -1,1 +1,2 @@\n+hello\n", "modified")]))),
    "clean",
  );
});

Deno.test("an empty PR body produces a note, not silence", () => {
  const findings = review(input([file("README.md", "@@ -1,1 +1,2 @@\n+hi\n", "modified")], {
    prBody: "   ",
  })).findings;
  assertEquals(findings[0].rule, "pr-description");
  assertEquals(findings[0].severity, "info");
});

Deno.test("the comment carries the marker, the counts and the rule titles", () => {
  const body = formatComment(
    input([file("backend/requirements.txt", "@@ -1,1 +1,2 @@\n+httpx\n", "modified")]),
    review(input([file("backend/requirements.txt", "@@ -1,1 +1,2 @@\n+httpx\n", "modified")])),
  );
  assertStringIncludes(body, "<!-- luckyseva-pr-review-bot -->");
  assertStringIncludes(body, "1 warning");
  assertStringIncludes(body, "Unpinned dependency");
  assertStringIncludes(body, "backend/requirements.txt:1");
});

Deno.test("a clean PR still gets a comment explaining what ran", () => {
  const clean = input([file("README.md", "@@ -1,1 +1,2 @@\n+hello\n", "modified")]);
  const body = formatComment(clean, review(clean));
  assertStringIncludes(body, "No findings");
  assertStringIncludes(body, "committed secrets");
});

Deno.test("every rule id is unique and declared in the exported list", () => {
  const ids = RULES.map((r) => r.id);
  assertEquals(new Set(ids).size, ids.length);
  for (const rule of RULES) {
    assert(rule.severity.length > 0);
    assert(rule.title.length > 0);
    assert(rule.description.length > 0);
  }
});
