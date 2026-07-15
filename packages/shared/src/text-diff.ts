/**
 * 行级文本差异（类 git unified）：供导入 / 同步冲突时人工裁决复用。
 * 底层使用 jsdiff（vendor/diff）的 Myers 实现，对外暴露本仓库稳定 API。
 */

import { createTwoFilesPatch, structuredPatch } from "./jsdiff-bridge";

export type DiffLineKind = "context" | "delete" | "add";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
  /** 左侧（旧）1-based 行号；add 行无此字段 */
  oldLine?: number;
  /** 右侧（新）1-based 行号；delete 行无此字段 */
  newLine?: number;
};

export type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

export type TextDiffResult = {
  identical: boolean;
  hunks: DiffHunk[];
};

export type HunkResolution =
  | { mode: "keepLeft" }
  | { mode: "keepRight" }
  | { mode: "edit"; text: string };

export type ComputeTextDiffOptions = {
  /** 每个变更块上下保留的上下文行数，默认 3（贴近 git diff） */
  contextLines?: number;
};

export type FormatUnifiedDiffOptions = {
  leftLabel?: string;
  rightLabel?: string;
};

/** 统一换行（CRLF / CR → LF），避免伪差异 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** 统一换行并拆成行数组（去掉因末尾 \n 产生的空尾巴） */
export function normalizeAndSplitLines(text: string): string[] {
  const normalized = normalizeNewlines(text);
  if (normalized === "") return [];
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

type JsDiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
};

type JsDiffPatch = {
  hunks: JsDiffHunk[];
};

function mapJsDiffHunk(hunk: JsDiffHunk): DiffHunk {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const lines: DiffLine[] = [];

  for (const raw of hunk.lines) {
    // jsdiff 可能插入 "\\ No newline at end of file"
    if (raw.startsWith("\\")) continue;
    const prefix = raw.charAt(0);
    const text = raw.slice(1);
    if (prefix === " ") {
      lines.push({ kind: "context", text, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (prefix === "-") {
      lines.push({ kind: "delete", text, oldLine });
      oldLine += 1;
    } else if (prefix === "+") {
      lines.push({ kind: "add", text, newLine });
      newLine += 1;
    }
  }

  return {
    oldStart: hunk.oldStart,
    oldCount: hunk.oldLines,
    newStart: hunk.newStart,
    newCount: hunk.newLines,
    lines,
  };
}

/**
 * 比对两段文本，产出类 git 的 hunk 列表。
 * left = base（本地 / 旧），right = incoming（导入 / 远端）。
 */
export function computeTextDiff(
  left: string,
  right: string,
  options?: ComputeTextDiffOptions,
): TextDiffResult {
  const contextLines = options?.contextLines ?? 3;
  const leftNorm = normalizeNewlines(left);
  const rightNorm = normalizeNewlines(right);

  if (leftNorm === rightNorm) {
    return { identical: true, hunks: [] };
  }

  const patch = structuredPatch(
    "left",
    "right",
    leftNorm,
    rightNorm,
    undefined,
    undefined,
    { context: contextLines },
  ) as JsDiffPatch | undefined;

  if (!patch?.hunks?.length) {
    return { identical: true, hunks: [] };
  }

  return {
    identical: false,
    hunks: patch.hunks.map(mapJsDiffHunk),
  };
}

function resolutionFor(
  index: number,
  resolutions: Record<number, HunkResolution> | ReadonlyMap<number, HunkResolution>,
): HunkResolution {
  if (typeof (resolutions as ReadonlyMap<number, HunkResolution>).get === "function") {
    return (
      (resolutions as ReadonlyMap<number, HunkResolution>).get(index) ?? {
        mode: "keepRight",
      }
    );
  }
  return (resolutions as Record<number, HunkResolution>)[index] ?? { mode: "keepRight" };
}

/**
 * 按 hunk 裁决合并文本。未给出的 hunk 默认 keepRight（偏向接受导入 / 远端侧）。
 */
export function applyHunkResolutions(
  left: string,
  right: string,
  hunks: readonly DiffHunk[],
  resolutions: Record<number, HunkResolution> | ReadonlyMap<number, HunkResolution>,
): string {
  const leftLines = normalizeAndSplitLines(left);
  const rightLines = normalizeAndSplitLines(right);

  if (hunks.length === 0) {
    return leftLines.join("\n");
  }

  const out: string[] = [];
  let leftCursor = 1; // 1-based，指向下一段尚未输出的左侧行

  hunks.forEach((hunk, index) => {
    while (leftCursor < hunk.oldStart) {
      out.push(leftLines[leftCursor - 1] ?? "");
      leftCursor += 1;
    }

    const res = resolutionFor(index, resolutions);
    if (res.mode === "keepLeft") {
      for (let i = 0; i < hunk.oldCount; i += 1) {
        out.push(leftLines[hunk.oldStart - 1 + i] ?? "");
      }
    } else if (res.mode === "keepRight") {
      for (let i = 0; i < hunk.newCount; i += 1) {
        out.push(rightLines[hunk.newStart - 1 + i] ?? "");
      }
    } else {
      const edited = normalizeAndSplitLines(res.text);
      out.push(...edited);
    }

    leftCursor = hunk.oldStart + hunk.oldCount;
  });

  while (leftCursor <= leftLines.length) {
    out.push(leftLines[leftCursor - 1] ?? "");
    leftCursor += 1;
  }

  return out.join("\n");
}

/** 生成可复制的 unified diff 文本（调试 / 人工审阅） */
export function formatUnifiedDiff(
  result: TextDiffResult,
  options?: FormatUnifiedDiffOptions,
): string {
  const leftLabel = options?.leftLabel ?? "a/file";
  const rightLabel = options?.rightLabel ?? "b/file";
  if (result.identical) {
    return "";
  }

  // 用本仓库 DiffHunk 回写，避免再依赖调用方持有原文
  const parts: string[] = [`--- ${leftLabel}`, `+++ ${rightLabel}`];
  for (const hunk of result.hunks) {
    parts.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    );
    for (const line of hunk.lines) {
      const prefix = line.kind === "context" ? " " : line.kind === "delete" ? "-" : "+";
      parts.push(`${prefix}${line.text}`);
    }
  }
  return parts.join("\n");
}

/**
 * 直接基于两侧原文生成 unified patch（jsdiff createTwoFilesPatch）。
 * 与 formatUnifiedDiff(result) 语义一致，便于调试对照。
 */
export function formatUnifiedDiffFromTexts(
  left: string,
  right: string,
  options?: FormatUnifiedDiffOptions & ComputeTextDiffOptions,
): string {
  const leftLabel = options?.leftLabel ?? "a/file";
  const rightLabel = options?.rightLabel ?? "b/file";
  const leftNorm = normalizeNewlines(left);
  const rightNorm = normalizeNewlines(right);
  if (leftNorm === rightNorm) return "";
  return createTwoFilesPatch(
    leftLabel,
    rightLabel,
    leftNorm,
    rightNorm,
    undefined,
    undefined,
    { context: options?.contextLines ?? 3 },
  );
}
