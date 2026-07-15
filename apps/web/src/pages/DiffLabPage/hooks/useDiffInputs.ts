/**
 * 左右输入：从 fs_files 选择或直接粘贴文本。
 */
import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db, type FsFileRow } from "@my-notes/local-db";

import type { DiffSideId, DiffSideInput } from "../types";

const EMPTY_FILES: FsFileRow[] = [];

const emptySide = (): DiffSideInput => ({
  fileId: null,
  fileName: null,
  text: "",
});

export function useDiffInputs() {
  const files = useLiveQuery(() => db.fs_files.toArray(), []) ?? EMPTY_FILES;

  const fileOptions = useMemo(
    () =>
      [...files]
        .sort((a, b) => a.name.localeCompare(b.name, "zh"))
        .map((f) => ({ value: f.id, label: `${f.name} (${f.kind})` })),
    [files],
  );

  const [left, setLeft] = useState<DiffSideInput>(emptySide);
  const [right, setRight] = useState<DiffSideInput>(emptySide);

  const setSideText = useCallback((side: DiffSideId, text: string) => {
    const setter = side === "left" ? setLeft : setRight;
    setter((prev) => ({
      ...prev,
      text,
      // 手动改正文后视为粘贴态，解除与文件的强绑定（仍保留上次文件名展示可选清空）
      fileId: null,
      fileName: null,
    }));
  }, []);

  const selectFile = useCallback(
    (side: DiffSideId, fileId: string | null) => {
      const setter = side === "left" ? setLeft : setRight;
      if (!fileId) {
        setter((prev) => ({ ...prev, fileId: null, fileName: null }));
        return;
      }
      const row = files.find((f) => f.id === fileId);
      if (!row) return;
      setter({
        fileId: row.id,
        fileName: row.name,
        text: row.contentText,
      });
    },
    [files],
  );

  return {
    left,
    right,
    fileOptions,
    setSideText,
    selectFile,
  };
}
