import MDEditor from "@uiw/react-md-editor";
import { Segmented } from "antd";
import { useCallback, useMemo } from "react";

import "@uiw/react-md-editor/markdown-editor.css";

import { SiteMarkdownReadView } from "./SiteMarkdownReadView";

export type DocPanelMode = "read" | "edit";

export type SiteMarkdownDocPanelProps = {
  siteName: string;
  draft: string;
  mode: DocPanelMode;
  onModeChange: (mode: DocPanelMode) => void;
  onDraftChange: (next: string) => void;
  onCopyEntryValue: (text: string) => void;
  isLoading: boolean;
};

export function SiteMarkdownDocPanel({
  siteName,
  draft,
  mode,
  onModeChange,
  onDraftChange,
  onCopyEntryValue,
  isLoading,
}: SiteMarkdownDocPanelProps) {
  const segmentedOptions = useMemo(
    (): { label: string; value: DocPanelMode }[] => [
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 font-medium text-[#262626]">
          <span className="text-[#8c8c8c]">当前站点</span>{" "}
          <span className="truncate">{siteName || "未命名"}</span>
        </div>
        <Segmented<DocPanelMode>
          options={segmentedOptions}
          value={mode}
          onChange={(v) => {
            onModeChange(v);
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#f0f0f0] bg-white">
        {isLoading ? (
          <div className="flex h-[min(480px,50vh)] items-center justify-center text-[#bfbfbf]">加载中…</div>
        ) : mode === "read" ? (
          <div className="h-[min(560px,calc(100vh-14rem))] overflow-auto p-4">
            <SiteMarkdownReadView source={draft} onCopyEntryValue={onCopyEntryValue} />
          </div>
        ) : (
          <div className="flex h-[min(560px,calc(100vh-14rem))] min-h-[320px] flex-col [&_.w-md-editor]:flex-1 [&_.w-md-editor]:border-0">
            <MDEditor
              value={draft}
              onChange={handleMdChange}
              height="100%"
              visibleDragbar={false}
              preview="edit"
              textareaProps={{ placeholder: "在此编写站点 Markdown…\n条目示例：**用户名**：zhangsan" }}
            />
          </div>
        )}
      </div>
      <p className="shrink-0 text-xs leading-relaxed text-[#8c8c8c]">
        条目规则：单独一行，格式为 <code className="rounded bg-[#f5f5f5] px-1">**名称**：内容</code>
        （冒号为中文全角「：」）。阅读模式下悬停条目内容有高亮，点击可复制「内容」部分。
      </p>
    </div>
  );
}
