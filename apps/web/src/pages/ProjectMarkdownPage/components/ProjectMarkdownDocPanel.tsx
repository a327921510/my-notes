import MDEditor from "@uiw/react-md-editor";
import { Segmented } from "antd";
import { useCallback, useMemo } from "react";

import "@uiw/react-md-editor/markdown-editor.css";

import { ProjectMarkdownExampleModal } from "./ProjectMarkdownExampleModal";
import { ProjectMarkdownReadView } from "./ProjectMarkdownReadView";

export type ProjectDocPanelMode = "read" | "edit";

export type ProjectMarkdownDocPanelProps = {
  projectName: string;
  draft: string;
  mode: ProjectDocPanelMode;
  onModeChange: (mode: ProjectDocPanelMode) => void;
  onDraftChange: (next: string) => void;
  onCopyCell: (text: string) => void;
  isLoading: boolean;
};

export function ProjectMarkdownDocPanel({
  projectName,
  draft,
  mode,
  onModeChange,
  onDraftChange,
  onCopyCell,
  isLoading,
}: ProjectMarkdownDocPanelProps) {
  const segmentedOptions = useMemo(
    (): { label: string; value: ProjectDocPanelMode }[] => [
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
          <span className="text-[#8c8c8c]">当前项目</span>{" "}
          <span className="truncate">{projectName || "未命名"}</span>
        </div>
        <Segmented<ProjectDocPanelMode>
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
          <div className="h-full overflow-auto p-4">
            <ProjectMarkdownReadView source={draft} onCopyCell={onCopyCell} />
          </div>
        ) : (
          <div className="flex h-[min(560px,calc(100vh-14rem))] min-h-[320px] flex-col [&_.w-md-editor]:flex-1 [&_.w-md-editor]:border-0">
            <MDEditor
              value={draft}
              onChange={handleMdChange}
              height="100%"
              visibleDragbar={false}
              preview="edit"
              textareaProps={{
                placeholder:
                  "在此编写项目 Markdown…\n\n示例表格（表头须依次为 地址、账号、密码、备注）：\n| 地址 | 账号 | 密码 | 备注 |\n| --- | --- | --- | --- |\n| https://a.com | user1 | *** | 测试 |",
              }}
            />
          </div>
        )}
      </div>
      <p className="shrink-0 text-xs leading-relaxed text-[#8c8c8c]">
        编辑区为 Markdown 源码；阅读区渲染为 HTML。
        <span className="ml-1">
          <ProjectMarkdownExampleModal />
        </span>
      </p>
    </div>
  );
}
