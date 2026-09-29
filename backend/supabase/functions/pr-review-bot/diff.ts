import type { ChangedFile, DiffLine, Hunk } from "./types.ts";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parsePatch(patch: string | null): Hunk[] {
  if (!patch) return [];

  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      const oldStart = Number(header[1]);
      const newStart = Number(header[3]);
      current = {
        oldStart,
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart,
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      hunks.push(current);
      oldLine = oldStart;
      newLine = newStart;
      continue;
    }

    if (current === null) continue;
    if (raw === "" || raw.startsWith("\\")) continue;

    const origin = raw[0];
    if (origin !== "+" && origin !== "-" && origin !== " ") continue;

    const text = raw.slice(1);
    if (origin === "+") {
      current.lines.push({ origin, text, oldLine: null, newLine });
      newLine += 1;
    } else if (origin === "-") {
      current.lines.push({ origin, text, oldLine, newLine: null });
      oldLine += 1;
    } else {
      current.lines.push({ origin, text, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  return hunks;
}

export function addedLines(hunks: Hunk[]): DiffLine[] {
  return hunks.flatMap((h) => h.lines.filter((l) => l.origin === "+"));
}

export function removedLines(hunks: Hunk[]): DiffLine[] {
  return hunks.flatMap((h) => h.lines.filter((l) => l.origin === "-"));
}

export function allLines(hunks: Hunk[]): DiffLine[] {
  return hunks.flatMap((h) => h.lines);
}

export function isUnreadable(file: ChangedFile): boolean {
  return file.patch === null;
}

export function parseFiles(files: ChangedFile[]): Map<string, Hunk[]> {
  const parsed = new Map<string, Hunk[]>();
  for (const file of files) {
    parsed.set(file.filename, parsePatch(file.patch));
  }
  return parsed;
}
