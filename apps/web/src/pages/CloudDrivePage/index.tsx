import { App, FloatButton, Splitter } from "antd";
import { CloudSyncOutlined } from "@ant-design/icons";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";
import { db } from "@my-notes/local-db";
import { SyncDirection } from "@my-notes/shared";

import { CloudDriveDetailPanel } from "./components/CloudDriveDetailPanel";
import { CloudDriveListPanel } from "./components/CloudDriveListPanel";
import { SyncCompareDrawer } from "./components/SyncCompareDrawer";
import { useCloudDriveMutations } from "./hooks/useCloudDriveMutations";
import { useCloudDrivePageData } from "./hooks/useCloudDrivePageData";
import { useDriveArchive } from "./hooks/useDriveArchive";
import { useDriveSyncCompare } from "./hooks/useDriveSyncCompare";

export function CloudDrivePage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { createFolder, removeFolder, addFile, renameFile, removeFile } = useCloudDriveMutations();
  const { filteredFolders, selectedFolder, selectedFiles } = useCloudDrivePageData(selectedFolderId, searchKeyword);
  const compare = useDriveSyncCompare(token);
  const archive = useDriveArchive();

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

  const openCompare = compare.openCompare;
  const handlePull = useCallback(() => {
    void openCompare(SyncDirection.PULL);
  }, [openCompare]);
  const handlePush = useCallback(() => {
    void openCompare(SyncDirection.PUSH);
  }, [openCompare]);

  const handleApply = useCallback(async () => {
    const result = await compare.applyCurrent();
    if (result.ok) message.success(result.message);
    else message.error(result.message);
  }, [compare, message]);

  const detailFiles = useMemo(() => selectedFiles, [selectedFiles]);
  const syncing = compare.state.loading || compare.state.applying;

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
              onPullFromCloud={handlePull}
              onPushToCloud={handlePush}
              onExportArchive={archive.exportArchive}
              onImportArchive={archive.openImportPicker}
            />
          </div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div className="h-full p-3">
            <CloudDriveDetailPanel
              folder={selectedFolder}
              files={detailFiles}
              syncing={syncing}
              onPull={handlePull}
              onPush={handlePush}
              onAddFile={() => void handleAddFile()}
              onDownloadFile={handleDownloadFile}
              onRenameFile={renameFile}
              onDeleteFile={removeFile}
            />
          </div>
        </Splitter.Panel>
      </Splitter>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilePicked} />
      <input {...archive.importInputProps} />
      <FloatButton
        type="primary"
        icon={<CloudSyncOutlined />}
        description="对比"
        tooltip="打开同步对比"
        onClick={handlePush}
      />
      <SyncCompareDrawer
        open={compare.state.open}
        direction={compare.state.direction}
        loading={compare.state.loading}
        applying={compare.state.applying}
        error={compare.state.error}
        diff={compare.state.diff}
        selectedKey={compare.state.selectedKey}
        onClose={compare.closeCompare}
        onChangeDirection={compare.setDirection}
        onSelectEntry={compare.selectEntry}
        onApply={handleApply}
        onRefresh={compare.refresh}
        loadEntryContent={compare.loadEntryContent}
      />
    </>
  );
}

export default CloudDrivePage;
