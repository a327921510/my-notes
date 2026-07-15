import type { DiffHunk, HunkResolution, TextDiffResult } from "@my-notes/shared";

export type DiffViewMode = "unified" | "side-by-side";

export type DiffSideId = "left" | "right";

export type DiffSideInput = {
  /** 选中的 fs_files.id；粘贴模式为空 */
  fileId: string | null;
  fileName: string | null;
  text: string;
};

export type ResolutionsMap = Record<number, HunkResolution>;

export type DiffSessionState = {
  result: TextDiffResult;
  resolutions: ResolutionsMap;
  mergedText: string;
};

export type { DiffHunk, HunkResolution, TextDiffResult };
