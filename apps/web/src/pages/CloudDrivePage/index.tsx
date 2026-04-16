import { App, FloatButton, Splitter } from "antd";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";
import { db } from "@my-notes/local-db";

import { CloudDriveDetailPanel } from "./components/CloudDriveDetailPanel";
import { CloudDriveListPanel } from "./components/CloudDriveListPanel";
import { SyncPanel } from "./components/SyncPanel";
import { useCloudDriveMutations } from "./hooks/useCloudDriveMutations";
import { useCloudDrivePageData } from "./hooks/useCloudDrivePageData";
import { useCloudDriveSyncActions } from "./hooks/useCloudDriveSyncActions";
import type { ConflictRecord } from "./types";

type SyncTaskState = {
  running: boolean;
  type: "push" | "pull" | null;
};

export function CloudDrivePage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [syncTaskState, setSyncTaskState] = useState<SyncTaskState>({ running: false, type: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { createFolder, removeFolder, addFile, renameFile, removeFile } = useCloudDriveMutations();
  const { pushToCloud, pullFromCloud } = useCloudDriveSyncActions(setSyncTaskState, setConflicts);
  const { filteredFolders, selectedFolder, selectedFiles } = useCloudDrivePageData(selectedFolderId, searchKeyword);

  useEffect(() => {
    if (filteredFolders.length === 0) {
      setSelectedFolderId(null);
      return;
    }
    if (!selectedFolderId || !filteredFolders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(filteredFolders[0].id);
    }
  }, [filteredFolders, selectedFolderId]);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        const id = await createFolder(name);
        setSelectedFolderId(id);
        message.success("目录创建成功");
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [createFolder, message],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      try {
        await removeFolder(folderId);
        message.success("目录已删除");
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeFolder],
  );

  const handleAddFile = useCallback(() => {
    if (!selectedFolderId) {
      message.warning("请先选择目录");
      return;
    }
    fileInputRef.current?.click();
  }, [message, selectedFolderId]);

  const handleFilePicked = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !selectedFolderId) return;
      let successCount = 0;
      for (const file of Array.from(files)) {
        try {
          await addFile({ folderId: selectedFolderId, file });
          successCount += 1;
        } catch (e) {
          message.error(`${file.name}：${(e as Error).message}`);
        }
      }
      if (successCount > 0) {
        message.success(`已新增 ${successCount} 个文件`);
      }
      event.target.value = "";
    },
    [addFile, message, selectedFolderId],
  );

  const handleDownloadFile = useCallback(
    async (file: { id: string; name: string; localBlobRef?: string; cloudId?: string }) => {
      let blob: Blob | null = null;
      if (file.localBlobRef) {
        const localBlob = await db.blobs.get(file.localBlobRef);
        blob = localBlob?.blob ?? null;
      }
      if (!blob && file.cloudId && token) {
        const res = await fetch(`/api/drive/files/${encodeURIComponent(file.cloudId)}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          blob = await res.blob();
        }
      }
      if (!blob) {
        message.error("无法下载文件：缺少本地或云端二进制");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [message, token],
  );

  const handlePush = useCallback(async () => {
    try {
      const result = await pushToCloud(token);
      message.success(`上行完成：目录 ${result.foldersSynced}，文件 ${result.filesSynced}`);
      setSyncPanelOpen(true);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, pushToCloud, token]);

  const handlePull = useCallback(async () => {
    try {
      const result = await pullFromCloud(token);
      message.success(`下行完成：新增目录 ${result.createdFolders}，自动处理冲突 ${result.pulledConflicts}`);
      if (result.downgradedFolders > 0 || result.downgradedFiles > 0) {
        message.warning(
          `检测到云端缺失，已将 ${result.downgradedFolders} 个目录、${result.downgradedFiles} 个文件转为仅本地`,
        );
      }
      setSyncPanelOpen(true);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, pullFromCloud, token]);

  const syncing = syncTaskState.running;
  const runningType = syncTaskState.type;

  const detailFiles = useMemo(() => selectedFiles, [selectedFiles]);

  const handleCloseSyncPanel = useCallback(() => setSyncPanelOpen(false), []);
  const handleOpenSyncPanel = useCallback(() => setSyncPanelOpen(true), []);

  return (
    <>
      <Splitter style={{ borderRadius: 8, boxShadow: "0 0 10px rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
        <Splitter.Panel defaultSize={320} min={260} max={480}>
          <div className="h-full p-3">
            <CloudDriveListPanel
              folders={filteredFolders}
              selectedFolderId={selectedFolderId}
              searchKeyword={searchKeyword}
              onSearchChange={setSearchKeyword}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onPullFromCloud={() => void handlePull()}
              onPushToCloud={() => void handlePush()}
            />
          </div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div className="h-full p-3">
            <CloudDriveDetailPanel
              folder={selectedFolder}
              files={detailFiles}
              syncing={syncing}
              onPull={() => void handlePull()}
              onPush={() => void handlePush()}
              onAddFile={() => void handleAddFile()}
              onDownloadFile={handleDownloadFile}
              onRenameFile={renameFile}
              onDeleteFile={removeFile}
            />
          </div>
        </Splitter.Panel>
      </Splitter>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilePicked} />
      <FloatButton
        type="primary"
        description="同步"
        tooltip="打开同步面板"
        onClick={handleOpenSyncPanel}
      />
      <SyncPanel
        open={syncPanelOpen}
        onClose={handleCloseSyncPanel}
        runningType={runningType}
        conflicts={conflicts}
      />
    </>
  );
}

export default CloudDrivePage;
