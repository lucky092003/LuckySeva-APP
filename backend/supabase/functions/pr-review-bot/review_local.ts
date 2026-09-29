import { formatComment, review } from "./checks.ts";
import type { ChangedFile } from "./types.ts";

const REF = Deno.args[0] ?? "HEAD";

async function git(args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args }).output();
  if (!out.success) {
    throw new Error(
      `git ${args.join(" ")} failed (exit ${out.code}): ${new TextDecoder().decode(out.stderr)}`,
    );
  }
  return new TextDecoder().decode(out.stdout);
}

const text = await git(["diff", "--no-color", REF]);
const files: ChangedFile[] = [];

let current: ChangedFile | null = null;
let body: string[] = [];
let additions = 0;
let deletions = 0;

function flush() {
  if (current === null) return;
  current.additions = additions;
  current.deletions = deletions;
  current.patch = body.join("\n");
  files.push(current);
}

for (const line of text.split("\n")) {
  if (line.startsWith("diff --git ")) {
    flush();
    const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (match === null) continue;
    current = { filename: match[2], status: "modified", additions: 0, deletions: 0, patch: null };
    body = [];
    additions = 0;
    deletions = 0;
    continue;
  }
  if (current === null) continue;
  if (current.status === "modified" && line.startsWith("new file mode")) {
    current.status = "added";
    continue;
  }
  if (current.status === "modified" && line.startsWith("deleted file mode")) {
    current.status = "removed";
    continue;
  }
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("index ")) continue;
  if (line.startsWith("@@")) {
    body.push(line);
    continue;
  }
  if (line.startsWith("+")) additions += 1;
  if (line.startsWith("-")) deletions += 1;
  body.push(line);
}
flush();

const input = {
  repoFullName: "local/dry-run",
  prNumber: 0,
  headSha: "0".repeat(40),
  prBody: "A local dry run, so the empty-description note stays out of the way.",
  files,
};

console.log(`Reviewing ${files.length} file(s) against ${REF}\n`);
console.log(formatComment(input, review(input, { minSeverity: "info" })));
