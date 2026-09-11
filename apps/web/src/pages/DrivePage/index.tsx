import {
  type DriveNode,
  type ImportPreflightResult,
  type ImportResult,
  NodeKind,
  NodeSortField,
  OnConflictStrategy,
  SortOrder,
} from "@my-notes/shared";
import { App, Card, Input, Splitter, Typography } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useDriveUsage } from "@/hooks/useDriveUsage";
import { pickFiles } from "@/lib/download";

import { ConflictModal } from "./components/ConflictModal";
import { DriveListPanel, type DriveListRow } from "./components/DriveListPanel";
import { DriveToolbar } from "./components/DriveToolbar";
import { DriveTreePanel } from "./components/DriveTreePanel";
import { ImportModal } from "./components/ImportModal";
import { MoveTargetModal } from "./components/MoveTargetModal";
import { UploadTaskList } from "./components/UploadTaskList";
import { useDriveList } from "./hooks/useDriveList";
import { useDriveMutations } from "./hooks/useDriveMutations";
import { useDriveSearch } from "./hooks/useDriveSearch";
import { useDriveTransfer } from "./hooks/useDriveTransfer";
import { useDriveTree } from "./hooks/useDriveTree";

type ImportSession = {
  file: File;
  targetId: string;
  targetName: string;
  preflight: ImportPreflightResult | null;
  result: ImportResult | null;
};

export function DrivePage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const folderId = searchParams.get("folderId");
  const keyword = searchParams.get("keyword") ?? "";
  const isSearchMode = keyword.trim() !== "";

  const [sort, setSort] = useState<NodeSortField>(NodeSortField.NAME);
  const [order, setOrder] = useState<SortOrder>(SortOrder.ASC);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [movingNodes, setMovingNodes] = useState<DriveNode[] | null>(null);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [importStrategy, setImportStrategy] = useState<OnConflictStrategy>(OnConflictStrategy.RENAME);

  const list = useDriveList({ folderId, sort, order });
  const search = useDriveSearch(keyword);
  const tree = useDriveTree();
  const { refresh: refreshUsage } = useDriveUsage();

  const refreshAll = useCallback(async () => {
    await Promise.all([list.reload(), tree.reload(), refreshUsage()]);
    if (isSearchMode) await search.reload();
  }, [isSearchMode, list, refreshUsage, search, tree]);

  const mutations = useDriveMutations(refreshAll);
  const transfer = useDriveTransfer(refreshAll);

  const currentFolderId = list.parent?.id ?? null;
  const rows: DriveListRow[] = isSearchMode ? search.items : list.nodes;
  const nodeById = useMemo(() => new Map(rows.map((row) => [row.id, row as DriveNode])), [rows]);
  const selectedNodes = useMemo(
    () => selectedIds.map((id) => nodeById.get(id)).filter((node): node is DriveNode => !!node),
    [nodeById, selectedIds],
  );

  const navigateToFolder = useCallback(
    (nextFolderId: string | null) => {
      setSelectedIds([]);
      setRenamingId(null);
      setSearchParams(nextFolderId ? { folderId: nextFolderId } : {});
    },
    [setSearchParams],
  );

  const handleOpen = useCallback(
    (node: DriveNode) => {
      if (node.kind === NodeKind.FOLDER) {
        navigateToFolder(node.id);
        return;
      }
      if (node.docKind === "mmd") {
        navigate(`/drive/doc/${node.id}`);
        return;
      }
      // 普通文件不支持预览，双击等同下载
      void transfer.downloadNode(node);
    },
    [navigate, navigateToFolder, transfer],
  );

  const promptName = useCallback(
    (title: string, defaultValue: string): Promise<string | null> =>
      new Promise((resolve) => {
        let draft = defaultValue;
        modal.confirm({
          title,
          okText: "创建",
          cancelText: "取消",
          content: (
            <Input
              autoFocus
              defaultValue={defaultValue}
              onChange={(event) => {
                draft = event.target.value;
              }}
            />
          ),
          onOk: () => resolve(draft),
          onCancel: () => resolve(null),
        });
      }),
    [modal],
  );

  const handleCreateFolder = useCallback(async () => {
    if (!currentFolderId) return;
    const name = await promptName("新建文件夹", "新建文件夹");
    if (name === null) return;
    await mutations.createFolder(currentFolderId, name);
  }, [currentFolderId, mutations, promptName]);

  const handleCreateDoc = useCallback(async () => {
    if (!currentFolderId) return;
    const name = await promptName("新建 .mmd 文档", "新建文档.mmd");
    if (name === null) return;
    const node = await mutations.createDoc(currentFolderId, name);
    if (node) navigate(`/drive/doc/${node.id}?mode=edit`);
  }, [currentFolderId, mutations, navigate, promptName]);

  const handleUpload = useCallback(async () => {
    if (!currentFolderId) return;
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    const summary = await transfer.uploadFiles(files, currentFolderId);
    if (summary) {
      message.success(`上传完成：成功 ${summary.done}，跳过 ${summary.skipped}，失败 ${summary.failed}`);
    }
  }, [currentFolderId, message, transfer]);

  const handleDropFiles = useCallback(
    async (files: File[]) => {
      if (!currentFolderId) return;
      const summary = await transfer.uploadFiles(files, currentFolderId);
      if (summary) {
        message.success(`上传完成：成功 ${summary.done}，跳过 ${summary.skipped}，失败 ${summary.failed}`);
      }
    },
    [currentFolderId, message, transfer],
  );

  const handleSortChange = useCallback((field: NodeSortField, nextOrder: SortOrder) => {
    setSort(field);
    setOrder(nextOrder);
  }, []);

  const handleRenameSubmit = useCallback(
    async (node: DriveNode, name: string) => {
      setRenamingId(null);
      await mutations.rename(node, name);
    },
    [mutations],
  );

  const handleBatchDelete = useCallback(async () => {
    const removed = await mutations.remove(selectedNodes);
    if (removed) setSelectedIds([]);
  }, [mutations, selectedNodes]);

  const handleMoveConfirm = useCallback(
    async (targetParentId: string) => {
      const nodes = movingNodes ?? [];
      setMovingNodes(null);
      const ok = await mutations.move(
        nodes.map((node) => node.id),
        targetParentId,
      );
      if (ok) setSelectedIds([]);
    },
    [movingNodes, mutations],
  );

  const handleExportCurrent = useCallback(async () => {
    if (!currentFolderId) return;
    await transfer.exportNodes({ folderId: currentFolderId });
  }, [currentFolderId, transfer]);

  const handleBatchDownload = useCallback(async () => {
    if (selectedIds.length === 0) return;
    await transfer.exportNodes({ ids: selectedIds });
  }, [selectedIds, transfer]);

  const handlePickArchive = useCallback(async () => {
    if (!currentFolderId || !list.parent) return;
    const [file] = await pickFiles({ accept: ".zip" });
    if (!file) return;

    setImportStrategy(OnConflictStrategy.RENAME);
    setImportSession({
      file,
      targetId: currentFolderId,
      targetName: list.parent.name,
      preflight: null,
      result: null,
    });
    const preflight = await transfer.preflightImport(file, currentFolderId);
    if (!preflight) {
      setImportSession(null);
      return;
    }
    setImportSession((prev) => (prev ? { ...prev, preflight } : prev));
  }, [currentFolderId, list.parent, transfer]);

  const handleImportConfirm = useCallback(async () => {
    if (!importSession) return;
    const result = await transfer.runImport(importSession.file, importSession.targetId, importStrategy);
    if (!result) return;
    setImportSession((prev) => (prev ? { ...prev, result } : prev));
  }, [importSession, importStrategy, transfer]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Splitter className="min-h-0 flex-1 rounded-lg bg-white shadow-sm">
        <Splitter.Panel defaultSize={260} min={200} max={420}>
          <div className="h-full overflow-auto p-2">
            <DriveTreePanel
              treeData={tree.treeData}
              expandedKeys={tree.expandedKeys}
              selectedKey={currentFolderId}
              loading={tree.loading}
              onExpandedKeysChange={tree.setExpandedKeys}
              onSelect={(id, isRoot) => navigateToFolder(isRoot ? null : id)}
              onLoadChildren={tree.loadChildren}
            />
          </div>
        </Splitter.Panel>

        <Splitter.Panel>
          <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            {isSearchMode ? (
              <Typography.Text type="secondary">
                搜索「{keyword}」，共 {search.total} 个结果。双击可打开所在项。
              </Typography.Text>
            ) : (
              <DriveToolbar
                path={list.path}
                selectedCount={selectedIds.length}
                disabled={!currentFolderId || transfer.busy || mutations.pending}
                onNavigate={navigateToFolder}
                onCreateFolder={handleCreateFolder}
                onCreateDoc={handleCreateDoc}
                onUpload={handleUpload}
                onImport={handlePickArchive}
                onExportCurrent={handleExportCurrent}
                onBatchDownload={handleBatchDownload}
                onBatchMove={() => setMovingNodes(selectedNodes)}
                onBatchDelete={handleBatchDelete}
                onClearSelection={() => setSelectedIds([])}
              />
            )}

            <div className="min-h-0 flex-1">
              <DriveListPanel
                rows={rows}
                loading={isSearchMode ? search.loading : list.loading}
                error={isSearchMode ? search.error : list.error}
                isSearchMode={isSearchMode}
                sort={sort}
                order={order}
                onSortChange={handleSortChange}
                selectedIds={selectedIds}
                renamingId={renamingId}
                onSelectedIdsChange={setSelectedIds}
                onOpen={handleOpen}
                onRenameStart={(node) => setRenamingId(node.id)}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenamingId(null)}
                onDownload={transfer.downloadNode}
                onMove={(node) => setMovingNodes([node])}
                onDelete={(node) => void mutations.remove([node])}
                onRetry={() => void (isSearchMode ? search.reload() : list.reload())}
                onDropFiles={handleDropFiles}
              />
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>

      {transfer.tasks.length > 0 ? (
        <Card
          size="small"
          title="上传任务"
          extra={
            <button type="button" className="cursor-pointer border-0 bg-transparent text-[#1677ff]" onClick={transfer.clearTasks}>
              清空
            </button>
          }
          className="max-h-[220px] overflow-auto"
        >
          <UploadTaskList tasks={transfer.tasks} />
        </Card>
      ) : null}

      <ConflictModal request={transfer.conflict} />

      <MoveTargetModal
        open={movingNodes !== null}
        movingIds={(movingNodes ?? []).map((node) => node.id)}
        onCancel={() => setMovingNodes(null)}
        onConfirm={handleMoveConfirm}
      />

      {importSession ? (
        <ImportModal
          open
          fileName={importSession.file.name}
          targetName={importSession.targetName}
          preflight={importSession.preflight}
          result={importSession.result}
          strategy={importStrategy}
          loading={transfer.busy}
          onStrategyChange={setImportStrategy}
          onConfirm={handleImportConfirm}
          onClose={() => setImportSession(null)}
        />
      ) : null}
    </div>
  );
}

export default DrivePage;
