/**
 * 计算 diff、维护 hunk 裁决，并生成合并预览。
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyHunkResolutions,
  computeTextDiff,
  type HunkResolution,
} from "@my-notes/shared";

import type { ResolutionsMap } from "../types";

export function useDiffSession(leftText: string, rightText: string) {
  const result = useMemo(
    () => computeTextDiff(leftText, rightText),
    [leftText, rightText],
  );

  const [resolutions, setResolutions] = useState<ResolutionsMap>({});

  useEffect(() => {
    setResolutions({});
  }, [leftText, rightText]);

  const setHunkResolution = useCallback((hunkIndex: number, resolution: HunkResolution) => {
    setResolutions((prev) => ({ ...prev, [hunkIndex]: resolution }));
  }, []);

  const keepAllLeft = useCallback(() => {
    const next: ResolutionsMap = {};
    result.hunks.forEach((_, i) => {
      next[i] = { mode: "keepLeft" };
    });
    setResolutions(next);
  }, [result.hunks]);

  const keepAllRight = useCallback(() => {
    const next: ResolutionsMap = {};
    result.hunks.forEach((_, i) => {
      next[i] = { mode: "keepRight" };
    });
    setResolutions(next);
  }, [result.hunks]);

  const mergedText = useMemo(
    () => applyHunkResolutions(leftText, rightText, result.hunks, resolutions),
    [leftText, rightText, result.hunks, resolutions],
  );

  return {
    result,
    resolutions,
    setHunkResolution,
    keepAllLeft,
    keepAllRight,
    mergedText,
  };
}
