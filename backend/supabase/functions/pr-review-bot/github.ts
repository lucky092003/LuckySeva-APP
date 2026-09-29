import { base64, base64Url, importPrivateKey } from "./pem.ts";
import type { ChangedFile } from "./types.ts";

const API = "https://api.github.com";
export const MARKER = "<!-- luckyseva-pr-review-bot -->";
const MAX_FILES = 300;
const MAX_PAGES = 3;

export class GitHubError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

interface InstallationToken {
  token: string;
  expiresAt: number;
}

const installationTokens = new Map<number, InstallationToken>();
let cachedKey: Promise<CryptoKey> | null = null;
let cachedAppJwt: { value: string; expiresAt: number } | null = null;

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

async function appJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAppJwt !== null && cachedAppJwt.expiresAt > now + 60) return cachedAppJwt.value;

  const appId = env("GITHUB_APP_ID");
  const pem = env("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (appId === "" || pem === "") {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are not both set");
  }

  if (cachedKey === null) cachedKey = importPrivateKey(pem);
  const key = await cachedKey;

  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(new TextEncoder().encode(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  ));
  const signingInput = new TextEncoder().encode(`${header}.${claims}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signingInput as BufferSource),
  );
  const value = `${header}.${claims}.${base64Url(signature)}`;
  cachedAppJwt = { value, expiresAt: now + 540 };
  return value;
}

async function request<T>(path: string, init: RequestInit, token: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "luckyseva-pr-review-bot",
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return null;

  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      // GitHub occasionally returns HTML from the edge; the raw prefix is enough.
    }
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      throw new GitHubError(403, "GitHub rate limit exhausted; try again later");
    }
    throw new GitHubError(response.status, `GitHub ${response.status} on ${path}: ${detail}`);
  }

  return text === "" ? null : JSON.parse(text);
}

export async function resolveToken(installationId?: number | null): Promise<string> {
  const pat = env("GITHUB_TOKEN");
  if (installationId === undefined || installationId === null) {
    if (pat === "") throw new Error("No installation id on the payload and GITHUB_TOKEN is unset");
    return pat;
  }

  const cached = installationTokens.get(installationId);
  if (cached !== undefined && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const jwt = await appJwt();
  const created = await request<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    { method: "POST" },
    jwt,
  );
  if (created === null) throw new Error("GitHub returned no installation token");
  installationTokens.set(installationId, {
    token: created.token,
    expiresAt: Date.parse(created.expires_at),
  });
  return created.token;
}

export async function listChangedFiles(
  repo: string,
  prNumber: number,
  token: string,
): Promise<ChangedFile[]> {
  const collected: ChangedFile[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await request<ChangedFile[]>(
      `/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      { method: "GET" },
      token,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    collected.push(...batch);
    if (collected.length >= MAX_FILES) return collected.slice(0, MAX_FILES);
  }

  return collected;
}

export async function findExistingComment(
  repo: string,
  prNumber: number,
  token: string,
): Promise<{ id: number; html_url: string } | null> {
  const comments = await request<Array<{ id: number; body: string; html_url: string }>>(
    `/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    { method: "GET" },
    token,
  );
  if (!Array.isArray(comments)) return null;

  for (const comment of comments) {
    if (typeof comment.body === "string" && comment.body.includes(MARKER)) {
      return { id: comment.id, html_url: comment.html_url };
    }
  }
  return null;
}

export interface CommentRef {
  id: number;
  html_url: string;
}

export async function postComment(
  repo: string,
  prNumber: number,
  body: string,
  token: string,
): Promise<CommentRef> {
  const created = await request<CommentRef>(
    `/repos/${repo}/issues/${prNumber}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
    token,
  );
  if (created === null) throw new Error("GitHub returned no comment after creating one");
  return created;
}

export async function updateComment(
  repo: string,
  commentId: number,
  body: string,
  token: string,
): Promise<CommentRef> {
  const updated = await request<CommentRef>(
    `/repos/${repo}/issues/comments/${commentId}`,
    { method: "PATCH", body: JSON.stringify({ body }) },
    token,
  );
  if (updated === null) throw new Error("GitHub returned no comment after updating one");
  return updated;
}

export async function submitReview(
  repo: string,
  prNumber: number,
  body: string,
  event: "REQUEST_CHANGES" | "COMMENT",
  token: string,
): Promise<void> {
  await request(
    `/repos/${repo}/pulls/${prNumber}/reviews`,
    { method: "POST", body: JSON.stringify({ body, event }) },
    token,
  );
}

export interface FileRef {
  content: string;
  sha: string;
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function readFile(
  repo: string,
  path: string,
  ref: string,
  token: string,
): Promise<FileRef | null> {
  const file = await request<{ content?: string; sha?: string; encoding?: string }>(
    `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { method: "GET" },
    token,
  );
  if (file === null || typeof file.sha !== "string") return null;
  if (file.encoding !== "base64" || typeof file.content !== "string") {
    throw new Error(`${path} came back as ${file.encoding ?? "unknown"} encoding; expected base64`);
  }
  return { content: decodeBase64(file.content), sha: file.sha };
}

export async function writeFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  previousSha: string | null,
  token: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    content: base64(new TextEncoder().encode(content)),
    branch,
  };
  if (previousSha !== null) body.sha = previousSha;
  await request(
    `/repos/${repo}/contents/${path}`,
    { method: "PUT", body: JSON.stringify(body) },
    token,
  );
}

async function branchExists(repo: string, branch: string, token: string): Promise<boolean> {
  const ref = await request<unknown>(
    `/repos/${repo}/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`,
    { method: "GET" },
    token,
  );
  return ref !== null;
}

export async function ensureBranch(
  repo: string,
  branch: string,
  fromSha: string,
  token: string,
): Promise<void> {
  if (await branchExists(repo, branch, token)) return;
  await request(
    `/repos/${repo}/git/refs`,
    { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }) },
    token,
  );
}

export interface OpenPr {
  number: number;
  html_url: string;
}

export async function findOpenPrForBranch(
  repo: string,
  branch: string,
  token: string,
): Promise<OpenPr | null> {
  const head = branch.includes("/") ? `${repo.split("/")[0]}:${branch}` : branch;
  const pulls = await request<Array<{ number: number; html_url: string }>>(
    `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(head)}&per_page=10`,
    { method: "GET" },
    token,
  );
  if (!Array.isArray(pulls) || pulls.length === 0) return null;
  return { number: pulls[0].number, html_url: pulls[0].html_url };
}

export async function openPr(
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
  token: string,
): Promise<OpenPr> {
  const created = await request<OpenPr>(
    `/repos/${repo}/pulls`,
    { method: "POST", body: JSON.stringify({ head, base, title, body }) },
    token,
  );
  if (created === null) throw new Error("GitHub returned no pull request after creating one");
  return created;
}
