import MDEditor from "@uiw/react-md-editor";
import { Segmented } from "antd";
import { memo, useCallback, useMemo } from "react";

import "@uiw/react-md-editor/markdown-editor.css";

import type { DocViewMode } from "../types";

export type MdDocumentViewProps = {
  fileName: string;
  draft: string;
  mode: DocViewMode;
  onModeChange: (mode: DocViewMode) => void;
  onDraftChange: (next: string) => void;
  isLoading: boolean;
};

export const MdDocumentView = memo(function MdDocumentView({
  fileName,
  draft,
  mode,
  onModeChange,
  onDraftChange,
  isLoading,
}: MdDocumentViewProps) {
  const segmentedOptions = useMemo(
    (): { label: string; value: DocViewMode }[] => [
      { label: "预览", value: "read" },
      { label: "编辑", value: "edit" },
    ],
    [],
  );

  const handleMdChange = useCallback(
    (val: string | undefined) => {
      onDraftChange(val ?? "");
    },
    [onDraftChange],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 truncate font-medium text-[#262626]">{fileName}</div>
        <Segmented<DocViewMode>
          options={segmentedOptions}
          value={mode}
          onChange={(v) => onModeChange(v)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#f0f0f0] bg-white">
        {isLoading ? (
          <div className="flex h-[min(480px,50vh)] items-center justify-center text-[#bfbfbf]">
            加载中…
          </div>
        ) : mode === "read" ? (
          <div data-color-mode="light" className="h-full overflow-auto p-4">
            {draft.trim() ? (
              <MDEditor.Markdown source={draft} />
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center text-[#bfbfbf]">
                暂无内容，请切换到「编辑」撰写 Markdown。
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col [&_.w-md-editor]:flex-1 [&_.w-md-editor]:border-0">
            <MDEditor
              value={draft}
              onChange={handleMdChange}
              height="100%"
              visibleDragbar={false}
              preview="edit"
              textareaProps={{ placeholder: "在此编写 Markdown…" }}
            />
          </div>
        )}
      </div>
    </div>
  );
});
