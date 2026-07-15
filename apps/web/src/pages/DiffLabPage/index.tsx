/**
 * 差异测试页：双侧输入 → 类 git hunk 审阅 / 裁决 → 合并预览。
 * 纯比对与裁决逻辑来自 @my-notes/shared/text-diff，供后续导入 / 同步复用。
 */
import { App, Alert, Button, Segmented, Space, Typography } from "antd";
import { useCallback, useState } from "react";

import { formatUnifiedDiff } from "@my-notes/shared";

import { DiffHunkList, DiffSideBySideView } from "@/components/text-diff";
import { DiffInputPanel } from "./components/DiffInputPanel";
import { DiffMergePreview } from "./components/DiffMergePreview";
import { useDiffInputs } from "./hooks/useDiffInputs";
import { useDiffSession } from "./hooks/useDiffSession";
import type { DiffViewMode } from "./types";

export function DiffLabPage() {
  const { message } = App.useApp();
  const { left, right, fileOptions, setSideText, selectFile } = useDiffInputs();
  const {
    result,
    resolutions,
    setHunkResolution,
    keepAllLeft,
    keepAllRight,
    mergedText,
  } = useDiffSession(left.text, right.text);
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");

  const handleCopyUnified = useCallback(async () => {
    const patch = formatUnifiedDiff(result, {
      leftLabel: left.fileName ? `a/${left.fileName}` : "a/left",
      rightLabel: right.fileName ? `b/${right.fileName}` : "b/right",
    });
    if (!patch) {
      message.info("无差异可复制");
      return;
    }
    try {
      await navigator.clipboard.writeText(patch);
      message.success("已复制 unified diff");
    } catch {
      message.error("复制失败");
    }
  }, [result, left.fileName, right.fileName, message]);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[1400px] flex-col gap-4 overflow-auto p-4">
      <div>
        <Typography.Title level={4} className="!mb-1">
          差异测试
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
          左 = 本地 / 旧（base），右 = 导入 / 远端（incoming）。按 hunk 人工裁决后查看合并结果；本期不落库。
        </Typography.Paragraph>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <DiffInputPanel
          title="左侧（base）"
          side={left}
          fileOptions={fileOptions}
          onSelectFile={(id) => selectFile("left", id)}
          onTextChange={(text) => setSideText("left", text)}
        />
        <DiffInputPanel
          title="右侧（incoming）"
          side={right}
          fileOptions={fileOptions}
          onSelectFile={(id) => selectFile("right", id)}
          onTextChange={(text) => setSideText("right", text)}
        />
      </div>

      {result.identical ? (
        <Alert type="success" showIcon message="完全一致" description="两侧规范化换行后无差异。" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Space wrap>
              <Segmented<DiffViewMode>
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { label: "Unified", value: "unified" },
                  { label: "并排", value: "side-by-side" },
                ]}
              />
              <Typography.Text type="secondary" className="text-sm">
                {result.hunks.length} 个 hunk
              </Typography.Text>
            </Space>
            <Space wrap>
              <Button size="small" onClick={keepAllLeft}>
                全部保留左
              </Button>
              <Button size="small" onClick={keepAllRight}>
                全部保留右
              </Button>
              <Button size="small" onClick={() => void handleCopyUnified()}>
                复制 unified
              </Button>
            </Space>
          </div>

          {viewMode === "unified" ? (
            <DiffHunkList
              hunks={result.hunks}
              resolutions={resolutions}
              onResolve={setHunkResolution}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <Alert
                type="info"
                showIcon
                message="并排视图仅供审阅；请切回 Unified 进行按 hunk 裁决。"
              />
              <DiffSideBySideView hunks={result.hunks} />
            </div>
          )}

          <DiffMergePreview mergedText={mergedText} identical={false} />
        </>
      )}

      {result.identical ? (
        <DiffMergePreview mergedText={left.text} identical />
      ) : null}
    </div>
  );
}

export default DiffLabPage;
