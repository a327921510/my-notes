import MDEditor from "@uiw/react-md-editor";
import { Segmented } from "antd";
import { memo, useCallback, useMemo } from "react";

import "@uiw/react-md-editor/markdown-editor.css";

import { RmExampleModal } from "../rm/RmExampleModal";
import { RmReadView } from "../rm/RmReadView";
import type { DocViewMode } from "../types";

export type RmDocumentViewProps = {
  fileName: string;
  draft: string;
  mode: DocViewMode;
  onModeChange: (mode: DocViewMode) => void;
  onDraftChange: (next: string) => void;
  onCopyCell: (text: string) => void;
  isLoading: boolean;
};

export const RmDocumentView = memo(function RmDocumentView({
  fileName,
  draft,
  mode,
  onModeChange,
  onDraftChange,
  onCopyCell,
  isLoading,
}: RmDocumentViewProps) {
  const segmentedOptions = useMemo(
    (): { label: string; value: DocViewMode }[] => [
      { label: "阅读", value: "read" },
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
          <div className="h-full overflow-auto p-4">
            <RmReadView source={draft} onCopyCell={onCopyCell} />
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col [&_.w-md-editor]:flex-1 [&_.w-md-editor]:border-0">
            <MDEditor
              value={draft}
              onChange={handleMdChange}
              height="100%"
              visibleDragbar={false}
              preview="edit"
              textareaProps={{
                placeholder:
                  "在此编写 .rm 文档…\n\n示例凭证表：\n| 地址 | 账号 | 密码 | 备注 |\n| --- | --- | --- | --- |\n| https://a.com | user1 | *** | 测试 |",
              }}
            />
          </div>
        )}
      </div>
      <p className="shrink-0 text-xs leading-relaxed text-[#8c8c8c]">
        .rm 为定制 Markdown：阅读区支持凭证表 / 代码仓库表专用渲染与复制。
        <span className="ml-1">
          <RmExampleModal />
        </span>
      </p>
    </div>
  );
});
