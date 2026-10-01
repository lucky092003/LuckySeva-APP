import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import {
  applyBlock,
  applyLastUpdated,
  type ChangelogEntry,
  classifyTitle,
  emptyChangelog,
  END_MARKER,
  entryDateFrom,
  hasChanged,
  newestEntryDate,
  renderBlock,
  START_MARKER,
  stripPrefix,
} from "./changelog.ts";

function entry(over: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    pr_number: 1,
    pr_title: "feat: add a thing",
    pr_author: "lucky092003",
    pr_url: "https://github.com/lucky092003/LuckySeva-App/pull/1",
    kind: "added",
    entry_date: "2026-09-30",
    ...over,
  };
}

Deno.test("classifyTitle maps conventional prefixes to buckets", () => {
  assertEquals(classifyTitle("feat: shared AddressForm"), "added");
  assertEquals(classifyTitle("feat(ui): buttons"), "added");
  assertEquals(classifyTitle("feature: bookings"), "added");
  assertEquals(classifyTitle("fix: ownership filter"), "fixed");
  assertEquals(classifyTitle("bugfix: null row"), "fixed");
  assertEquals(classifyTitle("hotfix: leaked token"), "fixed");
});

Deno.test("classifyTitle treats everything else as a change", () => {
  assertEquals(classifyTitle("refactor: split module"), "changed");
  assertEquals(classifyTitle("perf: faster query"), "changed");
  assertEquals(classifyTitle("docs: update readme"), "changed");
  assertEquals(classifyTitle("chore: bump deps"), "changed");
  assertEquals(classifyTitle("Address form: add validation"), "changed");
  assertEquals(classifyTitle("fix more working"), "changed");
  assertEquals(classifyTitle(""), "changed");
});

Deno.test("classifyTitle accepts a breaking marker and odd casing", () => {
  assertEquals(classifyTitle("feat!: drop v1 API"), "added");
  assertEquals(classifyTitle("FIX: uppercase"), "fixed");
});

Deno.test("stripPrefix removes the type and scope but keeps the rest", () => {
  assertEquals(stripPrefix("feat(ui): add a button"), "add a button");
  assertEquals(stripPrefix("fix!: correct the total"), "correct the total");
  assertEquals(stripPrefix("fix more working"), "fix more working");
  assertEquals(stripPrefix("feat:   spaced out"), "spaced out");
});

Deno.test("stripPrefix falls back to the full title when nothing is left", () => {
  assertEquals(stripPrefix("feat:"), "feat:");
  assertEquals(stripPrefix("feat:   "), "feat:");
});

Deno.test("entryDateFrom formats in UTC so a replay lands on the same day", () => {
  assertEquals(entryDateFrom("2026-09-30T23:59:59Z"), "2026-09-30");
  assertEquals(entryDateFrom("2026-10-01T00:30:00Z"), "2026-10-01");
  // 5:30pm in IST is still the 29th in UTC; the file must not drift by timezone.
  assertEquals(entryDateFrom("2026-09-29T17:30:00+05:30"), "2026-09-29");
});

Deno.test("entryDateFrom rejects an unparseable timestamp", () => {
  let threw = false;
  try {
    entryDateFrom("not a date");
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test("renderBlock groups by date, newest first", () => {
  const block = renderBlock([
    entry({ pr_number: 1, entry_date: "2026-09-28" }),
    entry({ pr_number: 3, entry_date: "2026-09-30" }),
    entry({ pr_number: 2, entry_date: "2026-09-30" }),
  ]);

  const first = block.indexOf("## 2026-09-30");
  const second = block.indexOf("## 2026-09-28");
  assert(first !== -1 && second !== -1);
  assert(first < second, "2026-09-30 must be listed above 2026-09-28");
  assert(block.indexOf("[#2]") < block.indexOf("[#3]"), "same-day entries order by PR number");
});

Deno.test("renderBlock splits one date into Added/Changed/Fixed", () => {
  const block = renderBlock([
    entry({ pr_number: 1, kind: "fixed" }),
    entry({ pr_number: 2, kind: "added" }),
    entry({ pr_number: 3, kind: "changed" }),
  ]);

  const added = block.indexOf("### Added");
  const changed = block.indexOf("### Changed");
  const fixed = block.indexOf("### Fixed");
  assert(added !== -1 && changed !== -1 && fixed !== -1);
  assert(
    added < changed && changed < fixed,
    "buckets render in a stable Added/Changed/Fixed order",
  );
  assertEquals(block.match(/^## /gm)?.length, 1, "one heading for a single date");
});

Deno.test("renderBlock omits a bucket with no entries for that date", () => {
  const block = renderBlock([entry({ kind: "fixed" })]);
  assertStringIncludes(block, "### Fixed");
  assert(!block.includes("### Added"), "an empty Added bucket is not rendered");
});

Deno.test("renderBlock drops the conventional prefix from the line", () => {
  const block = renderBlock([entry({ pr_title: "feat(frontend): shared AddressForm" })]);
  assertStringIncludes(block, "Shared AddressForm");
  assert(!block.includes("feat(frontend)"), "the prefix is redundant with the Added bucket");
});

Deno.test("renderBlock capitalises a stripped title but not an identifier", () => {
  const block = renderBlock([
    entry({ pr_number: 1, kind: "added", pr_title: "feat: share the AddressForm" }),
    entry({ pr_number: 2, kind: "changed", pr_title: "refactor: AdminHomeScreen splits" }),
  ]);
  assertStringIncludes(block, "Share the AddressForm");
  assertStringIncludes(block, "AdminHomeScreen splits");
});

Deno.test("renderBlock links the PR and credits the author", () => {
  const block = renderBlock([entry()]);
  assertStringIncludes(
    block,
    "- [#1](https://github.com/lucky092003/LuckySeva-App/pull/1) Add a thing — @lucky092003",
  );
});

Deno.test("renderBlock copes with a missing author or url", () => {
  const block = renderBlock([entry({ pr_author: null, pr_url: null })]);
  assertStringIncludes(block, "- #1 Add a thing");
  assert(!block.includes("@"), "no author means no handle");
});

Deno.test("renderBlock collapses a multi-line title and caps its length", () => {
  const block = renderBlock([entry({ pr_title: "feat: first line\n  second line" })]);
  assertStringIncludes(
    block,
    "- [#1](https://github.com/lucky092003/LuckySeva-App/pull/1) First line second line",
  );

  const long = renderBlock([entry({ pr_title: `feat: ${"x".repeat(400)}` })]);
  const line = long.split("\n").find((l) => l.startsWith("- [#1]")) ?? "";
  assert(line.length < 260, `line should be truncated, was ${line.length}`);
  assertStringIncludes(line, "…");
});

Deno.test("renderBlock emits exactly one marker pair", () => {
  const block = renderBlock([entry()]);
  assertEquals(block.split(START_MARKER).length - 1, 1);
  assertEquals(block.split(END_MARKER).length - 1, 1);
  assert(block.startsWith(START_MARKER));
  assert(block.trimEnd().endsWith(END_MARKER));
});

const EXISTING = [
  "# Changelog",
  "",
  "All notable changes to **LuckySeva** are documented in this file.",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "- Shared `AddressForm` component.",
  "",
].join("\n");

Deno.test("applyBlock inserts above the first heading and keeps the hand-written text", () => {
  const updated = applyBlock(EXISTING, "BLOCK");
  assertStringIncludes(updated, "BLOCK");
  assertStringIncludes(updated, "- Shared `AddressForm` component.");
  assert(updated.indexOf("BLOCK") < updated.indexOf("## [Unreleased]"));
  assert(updated.indexOf("## [Unreleased]") < updated.indexOf("- Shared `AddressForm` component."));
});

Deno.test("applyBlock replaces the previous block instead of appending a second", () => {
  const first = applyBlock(EXISTING, "OLD BLOCK");
  const second = applyBlock(first, "NEW BLOCK");

  assertEquals(second.split(START_MARKER).length - 1, 1);
  assertEquals(second.split(END_MARKER).length - 1, 1);
  assertStringIncludes(second, "NEW BLOCK");
  assert(!second.includes("OLD BLOCK"));
  assertStringIncludes(second, "- Shared `AddressForm` component.");
});

Deno.test("applyBlock is idempotent for the same block", () => {
  const once = applyBlock(EXISTING, "BLOCK");
  assertEquals(applyBlock(once, "BLOCK"), once);
});

Deno.test("applyBlock repairs a block whose end marker was lost", () => {
  const corrupt = `${EXISTING}\n${START_MARKER}\n## 2026-09-30\n- stale\n`;
  const repaired = applyBlock(corrupt, "BLOCK");
  assertEquals(repaired.split(START_MARKER).length - 1, 1);
  assertEquals(repaired.split(END_MARKER).length - 1, 1);
  assert(!repaired.includes("stale"));
});

Deno.test("applyBlock appends when the file has no headings", () => {
  const updated = applyBlock("# Changelog\n\nnothing yet\n", "BLOCK");
  assertStringIncludes(updated, "BLOCK");
  assertStringIncludes(updated, "nothing yet");
});

Deno.test("hasChanged only reports true when the block differs", () => {
  const written = applyBlock(EXISTING, "BLOCK");
  assertEquals(hasChanged(written, "BLOCK"), false);
  assertEquals(hasChanged(written, "OTHER"), true);
  assertEquals(hasChanged(EXISTING, "BLOCK"), true, "a file with no markers still needs a write");
  assertEquals(
    hasChanged(written.replace(END_MARKER, ""), "BLOCK"),
    true,
    "a half-written block is not trusted",
  );
  assertEquals(
    hasChanged(`${written}\n`, "BLOCK"),
    false,
    "trailing whitespace after the block is not a change",
  );
});

Deno.test("applyBlock and hasChanged agree on a block that lost its markers", () => {
  const bare = renderBlock([entry()]).replaceAll(START_MARKER, "").replaceAll(END_MARKER, "");
  const written = applyBlock(EXISTING, bare);
  assertEquals(written.split(START_MARKER).length - 1, 1, "markers are re-added on write");
  assertEquals(written.split(END_MARKER).length - 1, 1);
  assertEquals(
    hasChanged(written, bare),
    false,
    "otherwise every run would rewrite the file forever",
  );
});

Deno.test("emptyChangelog is a valid file the first run can extend", () => {
  const updated = applyBlock(emptyChangelog(), "BLOCK");
  assertStringIncludes(updated, "BLOCK");
  assertStringIncludes(updated, "## [Unreleased]");
});

Deno.test("newestEntryDate picks the latest day, or null when there are none", () => {
  assertEquals(newestEntryDate([]), null);
  assertEquals(newestEntryDate([entry({ entry_date: "2026-09-30" })]), "2026-09-30");
  assertEquals(
    newestEntryDate([
      entry({ entry_date: "2026-09-28" }),
      entry({ entry_date: "2026-10-01" }),
      entry({ entry_date: "2026-09-30" }),
    ]),
    "2026-10-01",
  );
});

Deno.test("applyLastUpdated inserts the line directly under the title", () => {
  const updated = applyLastUpdated(EXISTING, "2026-10-01");
  assertEquals(updated.split("\n")[2], "**Last updated:** 2026-10-01");
});

Deno.test("applyLastUpdated rewrites an existing date in place", () => {
  const once = applyLastUpdated(EXISTING, "2026-10-01");
  const twice = applyLastUpdated(once, "2026-10-02");
  assertStringIncludes(twice, "**Last updated:** 2026-10-02");
  assertEquals(twice.split("**Last updated:**").length - 1, 1, "the line is never duplicated");
});

Deno.test("applyLastUpdated is idempotent", () => {
  const once = applyLastUpdated(EXISTING, "2026-10-01");
  assertEquals(applyLastUpdated(once, "2026-10-01"), once);
});

Deno.test("applyLastUpdated still works on a file that has no title", () => {
  assertStringIncludes(
    applyLastUpdated("no title here", "2026-10-01"),
    "**Last updated:** 2026-10-01",
  );
});
