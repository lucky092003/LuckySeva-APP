export type Severity = "blocker" | "warning" | "info";

export const SEVERITY_ORDER: Severity[] = ["blocker", "warning", "info"];

export interface ChangedFile {
  filename: string;
  previous_filename?: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface DiffLine {
  origin: "+" | "-" | " ";
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface Finding {
  rule: string;
  severity: Severity;
  path: string;
  line: number | null;
  message: string;
  hint?: string;
}

export interface ReviewInput {
  repoFullName: string;
  prNumber: number;
  headSha: string;
  files: ChangedFile[];
  prTitle?: string;
  prBody?: string;
}

export interface ReviewResult {
  findings: Finding[];
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  unreadableFiles: string[];
}

export interface ReviewSettings {
  repoFullName: string;
  enabled: boolean;
  minSeverity: Severity;
  commentMode: "sticky" | "new" | "dry_run";
  rules: string[];
  blockOnBlocker: boolean;
  changelogEnabled: boolean;
  changelogBranch: string;
  changelogFile: string;
}

export const DEFAULT_SETTINGS: Omit<ReviewSettings, "repoFullName"> = {
  enabled: true,
  minSeverity: "warning",
  commentMode: "sticky",
  rules: [],
  blockOnBlocker: false,
  changelogEnabled: true,
  changelogBranch: "luckyseva/changelog",
  changelogFile: "CHANGELOG.md",
};

export type ChangelogStatus = "ok" | "unchanged" | "disabled" | "error";

export interface ChangelogOutcome {
  status: ChangelogStatus;
  prUrl: string | null;
  error: string | null;
}

export interface PrReviewRow {
  id: string;
  repo_full_name: string;
  pr_number: number;
  head_sha: string;
  verdict: "clean" | "findings" | "error" | "skipped";
  comment_id: number | null;
  comment_url: string | null;
  findings: unknown;
  error: string | null;
}
