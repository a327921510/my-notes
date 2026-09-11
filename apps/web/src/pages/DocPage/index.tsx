import { CREDENTIAL_TABLE_TEMPLATE, MergeStrategy } from "@my-notes/shared";
import { Alert, App, Card, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { BlockerFunction } from "react-router-dom";
import { useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { confirmAsync } from "@/lib/confirm";

import { DocDiffDrawer } from "./components/DocDiffDrawer";
import { DocEditorPanel } from "./components/DocEditorPanel";
import { type DocMode, DocToolbar } from "./components/DocToolbar";
import { MmdReadView } from "./components/MmdReadView";
import { useMmdDiff } from "./hooks/useMmdDiff";
import { useMmdDocument } from "./hooks/useMmdDocument";
import { useMmdMerge } from "./hooks/useMmdMerge";

export function DocPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { nodeId = "" } = useParams();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<DocMode>(searchParams.get("mode") === "edit" ? "edit" : "read");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const document = useMmdDocument(nodeId);
  const comparison = useMmdDiff(nodeId);
  const merge = useMmdMerge(comparison.diff);

  // 有未保存改动时拦截路由跳转与关闭窗口
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      document.dirty && currentLocation.pathname !== nextLocation.pathname,
    [document.dirty],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void confirmAsync(modal, {
      title: "放弃未保存的改动？",
      content: "当前文档有未保存的修改，离开后这些修改会丢失。",
      okText: "放弃改动并离开",
      okButtonProps: { danger: true },
      cancelText: "继续编辑",
    }).then((confirmed) => {
      if (confirmed) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, modal]);

  useEffect(() => {
    if (!document.dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [document.dirty]);

  const openComparison = useCallback(
    async (localText: string) => {
      const result = await comparison.compare(localText);
      if (!result) return;
      merge.reset(result.diff);
      setDrawerOpen(true);
    },
    [comparison, merge],
  );

  const handleSave = useCallback(async () => {
    const outcome = await document.save(document.draft);
    if (outcome.status === "saved") {
      message.success("已保存");
      return;
    }
    if (outcome.status === "failed") {
      message.error(outcome.message);
      return;
    }
    // 基版本过期：不覆盖，先算差异让用户决策
    const result = await comparison.compare(document.draft);
    if (!result) return;
    if (result.diff.identical) {
      const retry = await document.save(document.draft, result.snapshot.updatedAt);
      message[retry.status === "saved" ? "success" : "error"](
        retry.status === "saved" ? "内容一致，已保存" : "保存失败，请重试",
      );
      return;
    }
    merge.reset(result.diff);
    setDrawerOpen(true);
    message.warning("该文档已在别处被修改，请先处理差异");
  }, [comparison, document, merge, message]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (document.dirty) void handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [document.dirty, handleSave]);

  const handleInsertCredentialTable = useCallback(() => {
    const separator = document.draft.endsWith("\n") || document.draft === "" ? "" : "\n\n";
    document.setDraft(`${document.draft}${separator}${CREDENTIAL_TABLE_TEMPLATE}\n`);
  }, [document]);

  const handleCopyCell = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        message.success("已复制到剪贴板");
      } catch {
        message.error("复制失败，请检查浏览器权限");
      }
    },
    [message],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    comparison.clear();
  }, [comparison]);

  const saveWithServerBase = useCallback(
    async (content: string, successText: string) => {
      const base = comparison.snapshot?.updatedAt;
      const outcome = await document.save(content, base);
      if (outcome.status === "saved") {
        message.success(successText);
        closeDrawer();
        return;
      }
      if (outcome.status === "failed") {
        message.error(outcome.message);
        return;
      }
      // 期间又被第三方改动，重新对比，合并结果保留在抽屉里
      const result = await comparison.compare(content);
      if (result) merge.reset(result.diff);
      message.warning("服务端在此期间又被修改，已重新对比");
    },
    [closeDrawer, comparison, document, merge, message],
  );

  const handleOverwriteWithLocal = useCallback(
    () => saveWithServerBase(document.draft, "已用本机版本覆盖"),
    [document.draft, saveWithServerBase],
  );

  const handleSaveMerged = useCallback(
    () => saveWithServerBase(merge.mergedText, "已保存合并结果"),
    [merge.mergedText, saveWithServerBase],
  );

  const handleAdoptServer = useCallback(async () => {
    const snapshot = comparison.snapshot;
    if (!snapshot) return;
    const confirmed = await confirmAsync(modal, {
      title: "采用服务端版本？",
      content: "本机改动将被服务端内容替换，且不可恢复。",
      okText: "采用服务端版本",
      okButtonProps: { danger: true },
      cancelText: "取消",
    });
    if (!confirmed) return;
    document.adoptServerVersion(snapshot.content, snapshot.updatedAt);
    closeDrawer();
  }, [closeDrawer, comparison.snapshot, document, modal]);

  if (document.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (document.error) {
    return (
      <Alert
        className="m-3"
        type="error"
        showIcon
        title="无法打开该文档"
        description={document.error}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Card size="small" className="shrink-0">
        <DocToolbar
          name={document.node?.name ?? ""}
          mode={mode}
          dirty={document.dirty}
          saving={document.saving}
          comparing={comparison.loading}
          onModeChange={setMode}
          onBack={() => navigate("/drive")}
          onSave={handleSave}
          onCompare={() => void openComparison(document.draft)}
          onInsertCredentialTable={handleInsertCredentialTable}
        />
      </Card>

      <Card
        className="min-h-0 flex-1"
        styles={{ body: { height: "100%", padding: 16, overflow: "auto" } }}
      >
        {mode === "edit" ? (
          <DocEditorPanel value={document.draft} onChange={document.setDraft} />
        ) : (
          <MmdReadView source={document.draft} onCopyCell={handleCopyCell} />
        )}
      </Card>

      <DocDiffDrawer
        open={drawerOpen}
        loading={comparison.loading}
        diff={comparison.diff}
        hunkStates={merge.hunkStates}
        selection={merge.selection}
        pendingCount={merge.pendingCount}
        mergedText={merge.mergedText}
        isManuallyEdited={merge.isManuallyEdited}
        canSave={merge.canSave}
        saving={document.saving}
        onToggleLine={merge.toggleLine}
        onApplyHunkStrategy={merge.applyHunkStrategy}
        onApplyGlobalStrategy={(strategy: MergeStrategy) => merge.applyGlobalStrategy(strategy)}
        onMergedTextChange={merge.setManualText}
        onSaveMerged={handleSaveMerged}
        onOverwriteWithLocal={handleOverwriteWithLocal}
        onAdoptServer={handleAdoptServer}
        onClose={closeDrawer}
      />
    </div>
  );
}

export default DocPage;
