/**
 * Dependency-free line-level text diff producing GitHub-style unified hunks.
 * Used to render "本地 vs 远端" comparisons in the CloudDrive sync UI.
 *
 * The algorithm is a classic LCS (longest common subsequence) over lines,
 * then a backtrack into add/remove/context operations grouped into hunks
 * with a small amount of surrounding context (like `git diff -U<n>`).
 */

export const DiffLineType = {
  CONTEXT: "context",
  ADD: "add",
  REMOVE: "remove",
} as const;
export type DiffLineType = (typeof DiffLineType)[keyof typeof DiffLineType];

export type DiffLine = {
  type: DiffLineType;
  /** 1-based line number on the old (local/base) side, null for pure additions. */
  oldNumber: number | null;
  /** 1-based line number on the new (remote/target) side, null for pure removals. */
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

function groupHunks(ops: RawOp[], contextLines: number): DiffHunk[] {
  const changedIndices = ops
    .map((op, index) => (op.type === DiffLineType.CONTEXT ? -1 : index))
    .filter((index) => index >= 0);
  if (changedIndices.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  for (const idx of changedIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(ops.length - 1, idx + contextLines);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges.map((range) => {
    const slice = ops.slice(range.start, range.end + 1);
    const lines: DiffLine[] = slice.map((op) => ({
      type: op.type,
      oldNumber: op.oldIndex === null ? null : op.oldIndex + 1,
      newNumber: op.newIndex === null ? null : op.newIndex + 1,
      text: op.text,
    }));
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

export function diffLines(oldText: string, newText: string, contextLines = 3): TextDiffResult {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  if (oldText === newText) {
    return { hunks: [], stat: { additions: 0, deletions: 0 }, identical: true, truncated: false };
  }

  if (oldLines.length + newLines.length > MAX_DIFF_LINES) {
    return { hunks: [], stat: { additions: 0, deletions: 0 }, identical: false, truncated: true };
  }

  const ops = computeOps(oldLines, newLines);
  const hunks = groupHunks(ops, contextLines);
  const stat = ops.reduce<DiffStat>(
    (acc, op) => {
      if (op.type === DiffLineType.ADD) acc.additions += 1;
      else if (op.type === DiffLineType.REMOVE) acc.deletions += 1;
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
  return { hunks, stat, identical: false, truncated: false };
}
