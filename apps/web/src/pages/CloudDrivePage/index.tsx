import { App, Splitter } from "antd";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { db } from "@my-notes/local-db";

import { CloudDriveDetailPanel } from "./components/CloudDriveDetailPanel";
import { CloudDriveListPanel } from "./components/CloudDriveListPanel";
import { useCloudDriveMutations } from "./hooks/useCloudDriveMutations";
import { useCloudDrivePageData } from "./hooks/useCloudDrivePageData";
import type { DriveFile } from "./types";

export function CloudDrivePage() {
  const { message } = App.useApp();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { createFolder, removeFolder, addFile, renameFile, removeFile } = useCloudDriveMutations();
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
    async (file: DriveFile) => {
      let blob: Blob | null = null;
      if (file.localBlobRef) {
        const localBlob = await db.blobs.get(file.localBlobRef);
        blob = localBlob?.blob ?? null;
      }
      if (!blob) {
        message.error("无法下载文件：缺少本地二进制");
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
    [message],
  );

  const detailFiles = useMemo(() => selectedFiles, [selectedFiles]);

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
            />
          </div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div className="h-full p-3">
            <CloudDriveDetailPanel
              folder={selectedFolder}
              files={detailFiles}
              onAddFile={handleAddFile}
              onDownloadFile={handleDownloadFile}
              onRenameFile={renameFile}
              onDeleteFile={removeFile}
            />
          </div>
        </Splitter.Panel>
      </Splitter>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilePicked} />
    </>
  );
}

export default CloudDrivePage;
