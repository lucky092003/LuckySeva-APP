import { createClient } from "@supabase/supabase-js";

import { type ChangelogStore, type PullRequestEvent, recordChangelog } from "./changelog_writer.ts";
import type { ChangelogEntry } from "./changelog.ts";
import { formatComment, review, verdictOf } from "./checks.ts";
import {
  type CommentRef,
  findExistingComment,
  listChangedFiles,
  postComment,
  resolveToken,
  submitReview,
  updateComment,
} from "./github.ts";
import { verifySignature } from "./signature.ts";
import {
  type ChangelogOutcome,
  DEFAULT_SETTINGS,
  type PrReviewRow,
  type ReviewInput,
  type ReviewResult,
  type ReviewSettings,
  type Severity,
} from "./types.ts";

const HANDLED_ACTIONS = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);

// `opened` covers a normal PR and `ready_for_review` covers one that was drafted
// first. Both mean "this PR is real now", and the unique index on
// (repo_full_name, pr_number) makes a PR that fires both land only once.
const CHANGELOG_ACTIONS = new Set(["opened", "ready_for_review"]);

interface PullRequestPayload {
  action: string;
  installation?: { id: number } | null;
  repository: { full_name: string };
  pull_request: {
    number: number;
    draft?: boolean;
    title?: string;
    body?: string | null;
    head: { sha: string };
    created_at?: string;
    html_url?: string;
    user?: { login?: string };
    base?: { ref?: string; sha?: string };
  };
}

interface InstallationPayload {
  action: string;
  installation: { id: number };
  repositories?: Array<{ full_name: string }>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (url === "" || key === "") {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be available to this function",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SettingsRow = {
  repo_full_name: string;
  enabled: boolean;
  min_severity: Severity;
  comment_mode: "sticky" | "new" | "dry_run";
  rules: string[];
  block_on_blocker: boolean;
  changelog_enabled?: boolean;
  changelog_branch?: string;
  changelog_file?: string;
};

function toSettings(row: SettingsRow): ReviewSettings {
  return {
    repoFullName: row.repo_full_name,
    enabled: row.enabled,
    minSeverity: row.min_severity,
    commentMode: row.comment_mode,
    rules: Array.isArray(row.rules) ? row.rules : [],
    blockOnBlocker: row.block_on_blocker,
    changelogEnabled: row.changelog_enabled ?? DEFAULT_SETTINGS.changelogEnabled,
    changelogBranch: row.changelog_branch ?? DEFAULT_SETTINGS.changelogBranch,
    changelogFile: row.changelog_file ?? DEFAULT_SETTINGS.changelogFile,
  };
}

async function loadSettings(
  admin: ReturnType<typeof supabaseAdmin>,
  repoFullName: string,
): Promise<ReviewSettings> {
  const { data, error } = await admin
    .from("pr_review_settings")
    .select("*")
    .eq("repo_full_name", repoFullName)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`could not read pr_review_settings: ${error.message}`);
  }
  if (data === null) {
    const { error: insertError } = await admin
      .from("pr_review_settings")
      .insert({ repo_full_name: repoFullName });
    if (insertError !== null) {
      console.error("pr_review_settings", "default row insert failed", insertError.message);
    }
    return { repoFullName, ...DEFAULT_SETTINGS };
  }
  return toSettings(data as SettingsRow);
}

async function findPreviousRun(
  admin: ReturnType<typeof supabaseAdmin>,
  repoFullName: string,
  prNumber: number,
  headSha: string,
): Promise<PrReviewRow | null> {
  const { data, error } = await admin
    .from("pr_reviews")
    .select("*")
    .eq("repo_full_name", repoFullName)
    .eq("pr_number", prNumber)
    .eq("head_sha", headSha)
    .maybeSingle();
  if (error !== null) return null;
  return (data as PrReviewRow | null) ?? null;
}

function supabaseChangelogStore(
  admin: ReturnType<typeof supabaseAdmin>,
  repoFullName: string,
): ChangelogStore {
  return {
    async upsertEntry(entry) {
      const { error } = await admin.from("changelog_entries").upsert(
        {
          repo_full_name: repoFullName,
          pr_number: entry.pr_number,
          pr_title: entry.pr_title,
          pr_author: entry.pr_author,
          pr_url: entry.pr_url,
          kind: entry.kind,
          entry_date: entry.entry_date,
        },
        { onConflict: "repo_full_name,pr_number" },
      );
      if (error !== null) throw new Error(`could not store changelog entry: ${error.message}`);
    },
    async listEntries(repo) {
      const { data, error } = await admin
        .from("changelog_entries")
        .select("pr_number, pr_title, pr_author, pr_url, kind, entry_date")
        .eq("repo_full_name", repo)
        .order("entry_date", { ascending: false })
        .order("pr_number", { ascending: true });
      if (error !== null) throw new Error(`could not read changelog entries: ${error.message}`);
      return (data ?? []) as ChangelogEntry[];
    },
  };
}

async function recordRun(
  admin: ReturnType<typeof supabaseAdmin>,
  row: {
    repo_full_name: string;
    pr_number: number;
    head_sha: string;
    event: string;
    verdict: "clean" | "findings" | "error" | "skipped";
    result?: ReviewResult;
    comment?: CommentRef | null;
    changelog?: ChangelogOutcome | null;
    error?: string | null;
    duration_ms: number;
  },
): Promise<void> {
  // Upsert rather than insert: a run that failed is deliberately retryable, and
  // with the changelog now writing to the same row a plain insert would collide
  // with the UNIQUE (repo, pr, sha) index and lose the second attempt.
  const { error } = await admin.from("pr_reviews").upsert({
    repo_full_name: row.repo_full_name,
    pr_number: row.pr_number,
    head_sha: row.head_sha,
    event: row.event,
    verdict: row.verdict,
    blocker_count: row.result?.blockerCount ?? 0,
    warning_count: row.result?.warningCount ?? 0,
    info_count: row.result?.infoCount ?? 0,
    comment_id: row.comment?.id ?? null,
    comment_url: row.comment?.html_url ?? null,
    findings: row.result?.findings ?? [],
    changelog_status: row.changelog?.status ?? null,
    changelog_pr_url: row.changelog?.prUrl ?? null,
    error: row.error ?? null,
    duration_ms: row.duration_ms,
  }, { onConflict: "repo_full_name,pr_number,head_sha" });
  if (error !== null) console.error("pr_reviews", "upsert failed", error.message);
}

async function publishComment(
  mode: ReviewSettings["commentMode"],
  repoFullName: string,
  prNumber: number,
  body: string,
  token: string,
  previousCommentId: number | null,
): Promise<CommentRef | null> {
  if (mode === "dry_run") return null;
  if (mode === "new") return await postComment(repoFullName, prNumber, body, token);

  const id = previousCommentId ??
    (await findExistingComment(repoFullName, prNumber, token))?.id ?? null;
  if (id === null) return await postComment(repoFullName, prNumber, body, token);
  return await updateComment(repoFullName, id, body, token);
}

async function handlePullRequest(payload: PullRequestPayload): Promise<Response> {
  if (!HANDLED_ACTIONS.has(payload.action)) {
    return json({ ok: true, skipped: `action ${payload.action}` }, 200);
  }

  const repoFullName = payload.repository?.full_name;
  const pr = payload.pull_request;
  if (typeof repoFullName !== "string" || pr === undefined) {
    return json({ ok: false, error: "malformed pull_request payload" }, 400);
  }

  const admin = supabaseAdmin();
  const settings = await loadSettings(admin, repoFullName);
  if (!settings.enabled) return json({ ok: true, skipped: "disabled" }, 200);
  if (pr.draft === true) return json({ ok: true, skipped: "draft" }, 200);

  const headSha = pr.head?.sha ?? "";
  if (headSha === "") return json({ ok: false, error: "payload has no head sha" }, 400);

  const started = Date.now();
  const previous = await findPreviousRun(admin, repoFullName, pr.number, headSha);
  if (previous !== null && previous.verdict !== "error" && !CHANGELOG_ACTIONS.has(payload.action)) {
    return json({ ok: true, skipped: "already reviewed this commit" }, 200);
  }

  const token = await resolveToken(payload.installation?.id);

  // Run first and swallow its own errors: a changelog failure must not cost the
  // PR its review, and the outcome is reported separately either way.
  let changelog: ChangelogOutcome = { status: "disabled", prUrl: null, error: null };
  if (CHANGELOG_ACTIONS.has(payload.action) && settings.changelogEnabled) {
    const event: PullRequestEvent = {
      number: pr.number,
      title: pr.title ?? "",
      html_url: pr.html_url,
      user: pr.user,
      created_at: pr.created_at,
      base: pr.base,
    };
    try {
      changelog = await recordChangelog(
        repoFullName,
        event,
        settings,
        supabaseChangelogStore(admin, repoFullName),
        token,
      );
      if (changelog.status === "ok") {
        await admin.from("pr_review_settings")
          .update({ last_changelog_at: new Date().toISOString() })
          .eq("repo_full_name", repoFullName);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error("changelog failed", repoFullName, `#${pr.number}`, message);
      changelog = { status: "error", prUrl: null, error: message };
    }
  }

  try {
    const files = await listChangedFiles(repoFullName, pr.number, token);

    const input: ReviewInput = {
      repoFullName,
      prNumber: pr.number,
      headSha,
      files,
      prTitle: pr.title,
      prBody: pr.body ?? "",
    };
    const result = review(input, {
      minSeverity: settings.minSeverity,
      enabledRules: settings.rules,
    });

    const body = formatComment(input, result);
    const comment = await publishComment(
      settings.commentMode,
      repoFullName,
      pr.number,
      body,
      token,
      previous?.comment_id ?? null,
    );

    if (settings.blockOnBlocker && result.blockerCount > 0) {
      await submitReview(
        repoFullName,
        pr.number,
        `Found ${result.blockerCount} blocker(s) on this commit. See the review comment.`,
        "REQUEST_CHANGES",
        token,
      );
    }

    await recordRun(admin, {
      repo_full_name: repoFullName,
      pr_number: pr.number,
      head_sha: headSha,
      event: payload.action,
      verdict: verdictOf(result),
      result,
      comment,
      changelog,
      duration_ms: Date.now() - started,
    });
    await admin.from("pr_review_settings")
      .update({ last_review_at: new Date().toISOString() })
      .eq("repo_full_name", repoFullName);

    return json(
      {
        ok: true,
        verdict: verdictOf(result),
        blockers: result.blockerCount,
        warnings: result.warningCount,
        notes: result.infoCount,
        changelog: changelog.status,
        changelogPr: changelog.prUrl,
      },
      200,
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("review failed", repoFullName, `#${pr.number}`, message);
    await recordRun(admin, {
      repo_full_name: repoFullName,
      pr_number: pr.number,
      head_sha: headSha,
      event: payload.action,
      verdict: "error",
      changelog,
      error: message,
      duration_ms: Date.now() - started,
    });
    return json({ ok: false, error: message, changelog: changelog.status }, 502);
  }
}

async function handleInstallation(payload: InstallationPayload): Promise<Response> {
  if (payload.action !== "created" && payload.action !== "new_permissions_accepted") {
    return json({ ok: true, skipped: `action ${payload.action}` }, 200);
  }
  const admin = supabaseAdmin();
  const rows = (payload.repositories ?? []).map((repo) => ({ repo_full_name: repo.full_name }));
  if (rows.length === 0) return json({ ok: true, inserted: 0 }, 200);

  const { error } = await admin
    .from("pr_review_settings")
    .upsert(rows, { onConflict: "repo_full_name", ignoreDuplicates: true });
  if (error !== null) {
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, inserted: rows.length }, 200);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "POST only" }, 405);
  }

  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "";
  if (secret === "") {
    console.error("GITHUB_WEBHOOK_SECRET is not set; refusing to accept webhooks");
    return json({ ok: false, error: "GITHUB_WEBHOOK_SECRET is not set" }, 500);
  }

  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!(await verifySignature(body, signature, secret))) {
    return json({ ok: false, error: "bad signature" }, 401);
  }

  const event = request.headers.get("x-github-event");
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "body is not JSON" }, 400);
  }

  try {
    if (event === "ping") return json({ ok: true, pong: true }, 200);
    if (event === "pull_request") return await handlePullRequest(payload as PullRequestPayload);
    if (event === "installation") return await handleInstallation(payload as InstallationPayload);
    return json({ ok: true, skipped: `event ${event ?? "none"}` }, 200);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("handler failed", event, message);
    return json({ ok: false, error: message }, 500);
  }
});
