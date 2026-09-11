/**
 * Dependency-free line-level text diff producing GitHub-style unified hunks.
 * 用于 `.mmd` 并发编辑的「服务端版本 vs 本机版本」对比与行级合并。
 *
 * The algorithm is a classic LCS (longest common subsequence) over lines,
 * then a backtrack into add/remove/context operations grouped into hunks
 * with a small amount of surrounding context (like `git diff -U<n>`).
 *
 * 约定：`oldText` 为服务端版本、`newText` 为本机版本，因此同一处的 REMOVE 行
 * （服务端独有）总是排在 ADD 行（本机独有）之前，与「两者都留」的直觉一致。
 */

export const DiffLineType = {
  CONTEXT: "context",
  ADD: "add",
  REMOVE: "remove",
} as const;
export type DiffLineType = (typeof DiffLineType)[keyof typeof DiffLineType];

export type DiffLine = {
  /** 0-based position in the full diff sequence; stable id for line-level merge selection. */
  index: number;
  type: DiffLineType;
  /** 1-based line number on the old (server) side, null for pure additions. */
  oldNumber: number | null;
  /** 1-based line number on the new (local) side, null for pure removals. */
  newNumber: number | null;
  text: string;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
};

export type DiffStat = {
  additions: number;
  deletions: number;
};

export type TextDiffResult = {
  /** Full ordered diff sequence (including unchanged lines outside hunks). */
  lines: DiffLine[];
  hunks: DiffHunk[];
  stat: DiffStat;
  /** True when the two inputs are byte-identical (no hunks). */
  identical: boolean;
  /** True when inputs were too large and comparison was skipped. */
  truncated: boolean;
};

/** Guard against pathological O(n*m) blowups on very large files. */
const MAX_DIFF_LINES = 6000;

type RawOp = { type: DiffLineType; oldIndex: number | null; newIndex: number | null; text: string };

function splitLines(input: string): string[] {
  if (input === "") return [];
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split("\n");
}

function computeOps(oldLines: string[], newLines: string[]): RawOp[] {
  const n = oldLines.length;
  const m = newLines.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = oldLines[i] === newLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: RawOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: DiffLineType.CONTEXT, oldIndex: i, newIndex: j, text: oldLines[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: DiffLineType.REMOVE, oldIndex: i, newIndex: null, text: oldLines[i] });
      i += 1;
    } else {
      ops.push({ type: DiffLineType.ADD, oldIndex: null, newIndex: j, text: newLines[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: DiffLineType.REMOVE, oldIndex: i, newIndex: null, text: oldLines[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: DiffLineType.ADD, oldIndex: null, newIndex: j, text: newLines[j] });
    j += 1;
  }
  return ops;
}

function groupHunks(allLines: DiffLine[], contextLines: number): DiffHunk[] {
  const changedIndices = allLines
    .map((line, index) => (line.type === DiffLineType.CONTEXT ? -1 : index))
    .filter((index) => index >= 0);
  if (changedIndices.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(allLines.length - 1, idx + contextLines);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges.map((range) => {
    const lines = allLines.slice(range.start, range.end + 1);
    const oldNumbers = lines.map((l) => l.oldNumber).filter((v): v is number => v !== null);
    const newNumbers = lines.map((l) => l.newNumber).filter((v): v is number => v !== null);
    const oldStart = oldNumbers.length > 0 ? oldNumbers[0] : 0;
    const newStart = newNumbers.length > 0 ? newNumbers[0] : 0;
    const oldCount = oldNumbers.length;
    const newCount = newNumbers.length;
    return {
      oldStart,
      oldLines: oldCount,
      newStart,
      newLines: newCount,
      header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      lines,
    };
  });
}

function mapOpToDiffLine(op: RawOp, index: number): DiffLine {
  return {
    index,
    type: op.type,
    oldNumber: op.oldIndex === null ? null : op.oldIndex + 1,
    newNumber: op.newIndex === null ? null : op.newIndex + 1,
    text: op.text,
  };
}

/** `oldText` 为服务端版本、`newText` 为本机版本。 */
export function diffLines(oldText: string, newText: string, contextLines = 3): TextDiffResult {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const empty = { lines: [], hunks: [], stat: { additions: 0, deletions: 0 } };

  if (oldText === newText) {
    return { ...empty, identical: true, truncated: false };
  }

  if (oldLines.length + newLines.length > MAX_DIFF_LINES) {
    return { ...empty, identical: false, truncated: true };
  }

  const lines = computeOps(oldLines, newLines).map(mapOpToDiffLine);
  const hunks = groupHunks(lines, contextLines);
  const stat = lines.reduce<DiffStat>(
    (acc, line) => {
      if (line.type === DiffLineType.ADD) acc.additions += 1;
      else if (line.type === DiffLineType.REMOVE) acc.deletions += 1;
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
  return { lines, hunks, stat, identical: false, truncated: false };
}
