import { assertEquals } from "@std/assert";

import { addedLines, parsePatch, removedLines } from "./diff.ts";

const PATCH = [
  "@@ -10,6 +10,7 @@ def handler(request: Request):",
  "     ctx = get_context(request)",
  "-    return old_path",
  "+    filtered = apply_filter(ctx)",
  "+    return filtered",
  "     ",
  "@@ -40,3 +41,2 @@",
  "-    a = 1",
  "-    b = 2",
  "+    c = 3",
].join("\n");

Deno.test("parsePatch numbers added and removed lines separately", () => {
  const hunks = parsePatch(PATCH);
  assertEquals(hunks.length, 2);

  const added = addedLines(hunks);
  assertEquals(added.map((l) => l.text), [
    "    filtered = apply_filter(ctx)",
    "    return filtered",
    "    c = 3",
  ]);
  assertEquals(added.map((l) => l.newLine), [11, 12, 41]);
  assertEquals(added.map((l) => l.oldLine), [null, null, null]);

  const removed = removedLines(hunks);
  assertEquals(removed.map((l) => l.text), ["    return old_path", "    a = 1", "    b = 2"]);
  assertEquals(removed.map((l) => l.oldLine), [11, 40, 41]);
});

Deno.test("parsePatch keeps context lines on both sides", () => {
  const hunks = parsePatch(PATCH);
  const context = hunks[0].lines.filter((l) => l.origin === " ");
  assertEquals(context.map((l) => l.text), ["    ctx = get_context(request)", "    "]);
  assertEquals(context.map((l) => l.oldLine), [10, 12]);
  assertEquals(context.map((l) => l.newLine), [10, 13]);
});

Deno.test("parsePatch handles a single-line hunk with no count", () => {
  const hunks = parsePatch("@@ -5 +5 @@\n-old\n+new");
  assertEquals(hunks.length, 1);
  assertEquals(hunks[0].oldLines, 1);
  assertEquals(hunks[0].newLines, 1);
  assertEquals(addedLines(hunks)[0].newLine, 5);
  assertEquals(removedLines(hunks)[0].oldLine, 5);
});

Deno.test("parsePatch ignores the no-newline marker", () => {
  const hunks = parsePatch("@@ -1,1 +1,1 @@\n-old\n\\ No newline at end of file\n+new");
  assertEquals(hunks[0].lines.length, 2);
});

Deno.test("parsePatch returns nothing for a missing or junk patch", () => {
  assertEquals(parsePatch(null), []);
  assertEquals(parsePatch(""), []);
  assertEquals(parsePatch("not a diff at all"), []);
  assertEquals(parsePatch("+added with no hunk header"), []);
});

Deno.test("parsePatch does not mistake a diff line for a hunk header", () => {
  const hunks = parsePatch("@@ -1,2 +1,2 @@\n+@@ -9,9 +9,9 @@\n context");
  assertEquals(hunks.length, 1);
  assertEquals(addedLines(hunks)[0].text, "@@ -9,9 +9,9 @@");
});
