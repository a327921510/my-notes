/**
 * 右侧文档编辑区：按文件 kind 分发 .md / .rm 视图。
 */
import { App, Empty } from "antd";
import { memo, useCallback, useEffect, useState } from "react";

import { useFsDocument } from "../hooks/useFsDocument";
import type { DocViewMode, FsTreeSelection } from "../types";
import { MdDocumentView } from "./MdDocumentView";
import { RmDocumentView } from "./RmDocumentView";

export type FileEditorPanelProps = {
  selection: FsTreeSelection | null;
};

export const FileEditorPanel = memo(function FileEditorPanel({
  selection,
}: FileEditorPanelProps) {
  const { message } = App.useApp();
  const file = selection?.selectedFile ?? null;
  const { draft, setDraftAndPersist, isLoading } = useFsDocument(file?.id ?? null);
  const [mode, setMode] = useState<DocViewMode>("edit");

  useEffect(() => {
    setMode(file?.kind === "rm" ? "read" : "edit");
  }, [file?.id, file?.kind]);

  const handleCopyCell = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) {
        message.info("单元格为空");
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        message.success("已复制");
      } catch {
        message.error("复制失败");
      }
    },
    [message],
  );

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty description="选择一个文件以开始编辑" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  if (file.kind === "rm") {
    return (
      <RmDocumentView
        fileName={file.name}
        draft={draft}
        mode={mode}
        onModeChange={setMode}
        onDraftChange={setDraftAndPersist}
        onCopyCell={handleCopyCell}
        isLoading={isLoading}
      />
    );
  }

  return (
    <MdDocumentView
      fileName={file.name}
      draft={draft}
      mode={mode}
      onModeChange={setMode}
      onDraftChange={setDraftAndPersist}
      isLoading={isLoading}
    />
  );
});
