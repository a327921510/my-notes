import {
  type DiffHunk,
  DiffLineType,
  MergeStrategy,
  type TextDiffResult,
  createDefaultMergeSelection,
  mapMergeSelectionToText,
  mapSelectionWithStrategy,
} from "@my-notes/shared";
import { useCallback, useMemo, useState } from "react";

export type MergeHunkState = {
  hunk: DiffHunk;
  index: number;
  resolved: boolean;
};

/** 只有同时含删行与增行之外的块也需确认，统一以「用户是否操作过」判定已处理。 */
function hasChangedLines(hunk: DiffHunk): boolean {
  return hunk.lines.some((line) => line.type !== DiffLineType.CONTEXT);
}

/**
 * 行级采纳的选择态：逐行勾选 + 块级 / 全局批量，并维护待处理门槛。
 * 结果文本可被手工改写；再次改动勾选会以勾选结果为准。
 */
export function useMmdMerge(diff: TextDiffResult | null) {
  const [selection, setSelection] = useState<Set<number>>(() => new Set());
  const [resolvedHunks, setResolvedHunks] = useState<Set<number>>(() => new Set());
  const [manualText, setManualText] = useState<string | null>(null);

  const reset = useCallback((next: TextDiffResult | null) => {
    setSelection(next ? createDefaultMergeSelection(next.lines) : new Set());
    setResolvedHunks(new Set());
    setManualText(null);
  }, []);

  const hunkStates = useMemo<MergeHunkState[]>(() => {
    if (!diff) return [];
    return diff.hunks
      .map((hunk, index) => ({ hunk, index, resolved: resolvedHunks.has(index) }))
      .filter((item) => hasChangedLines(item.hunk));
  }, [diff, resolvedHunks]);

  const pendingCount = useMemo(
    () => hunkStates.filter((item) => !item.resolved).length,
    [hunkStates],
  );

  const markResolved = useCallback((hunkIndex: number) => {
    setResolvedHunks((prev) => {
      if (prev.has(hunkIndex)) return prev;
      const next = new Set(prev);
      next.add(hunkIndex);
      return next;
    });
  }, []);

  const toggleLine = useCallback(
    (lineIndex: number, hunkIndex: number) => {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(lineIndex)) next.delete(lineIndex);
        else next.add(lineIndex);
        return next;
      });
      setManualText(null);
      markResolved(hunkIndex);
    },
    [markResolved],
  );

  const applyHunkStrategy = useCallback(
    (hunkIndex: number, strategy: MergeStrategy) => {
      if (!diff) return;
      const hunk = diff.hunks[hunkIndex];
      if (!hunk) return;
      setSelection((prev) => mapSelectionWithStrategy(prev, hunk.lines, strategy));
      setManualText(null);
      markResolved(hunkIndex);
    },
    [diff, markResolved],
  );

  const applyGlobalStrategy = useCallback(
    (strategy: MergeStrategy) => {
      if (!diff) return;
      setSelection((prev) => mapSelectionWithStrategy(prev, diff.lines, strategy));
      setManualText(null);
      setResolvedHunks(new Set(diff.hunks.map((_hunk, index) => index)));
    },
    [diff],
  );

  const computedText = useMemo(
    () => (diff ? mapMergeSelectionToText(diff.lines, selection) : ""),
    [diff, selection],
  );

  const mergedText = manualText ?? computedText;

  return {
    selection,
    hunkStates,
    pendingCount,
    mergedText,
    isManuallyEdited: manualText !== null,
    canSave: diff !== null && pendingCount === 0,
    reset,
    toggleLine,
    applyHunkStrategy,
    applyGlobalStrategy,
    setManualText,
  };
}

export { MergeStrategy };
