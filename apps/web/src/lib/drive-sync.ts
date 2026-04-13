import { db } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";

type CloudFolderPayload = {
  cloudId: string;
  clientFolderId: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
};

type CloudFilePayload = {
  cloudId: string;
  clientFileId: string;
  clientFolderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  storageId: string;
  updatedAt: number;
};

async function downloadCloudFileBlob(token: string, cloudFileId: string): Promise<Blob> {
  const res = await fetch(`/api/drive/files/${encodeURIComponent(cloudFileId)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "下载云端文件失败");
  }
  return res.blob();
}

export async function pushDriveToCloud(
  token: string,
): Promise<{ foldersSynced: number; filesSynced: number; failedFileIds: string[] }> {
  const remoteFileRes = await fetch("/api/drive/files", { headers: { Authorization: `Bearer ${token}` } });
  const remoteClientFileIds = new Set<string>();
  if (remoteFileRes.ok) {
    const { items } = (await remoteFileRes.json()) as { items: CloudFilePayload[] };
    for (const item of items) {
      remoteClientFileIds.add(item.clientFileId);
    }
  }

  const tombstones = await db.drive_file_tombstones.toArray();
  for (const tombstone of tombstones) {
    if (!remoteClientFileIds.has(tombstone.clientFileId)) {
      await db.drive_file_tombstones.delete(tombstone.id);
      continue;
    }
    const res = await fetch(`/api/drive/files/${encodeURIComponent(tombstone.clientFileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 404) {
      await db.drive_file_tombstones.delete(tombstone.id);
    } else {
      await db.drive_file_tombstones.update(tombstone.id, { syncStatus: "failed" });
    }
  }

  const folderCandidates = await db.drive_folders.filter((x) => x.syncStatus !== "synced").toArray();
  const fileCandidates = await db.drive_files.filter((x) => x.syncStatus !== "synced").toArray();

  let foldersSynced = 0;
  for (const folder of folderCandidates) {
    const res = await fetch("/api/drive/folders/upsert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clientFolderId: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        path: folder.path,
        updatedAt: folder.updatedAt,
      }),
    });
    if (!res.ok) {
      await db.drive_folders.update(folder.id, { syncStatus: "failed" });
      continue;
    }
    const data = (await res.json()) as { cloudId: string };
    await db.drive_folders.update(folder.id, { syncStatus: "synced", cloudId: data.cloudId, updatedAt: Date.now() });
    foldersSynced++;
  }

  let filesSynced = 0;
  const failedFileIds: string[] = [];
  for (const file of fileCandidates) {
    if (!file.localBlobRef) {
      await db.drive_files.update(file.id, { syncStatus: "failed" });
      failedFileIds.push(file.id);
      continue;
    }
    const blobRow = await db.blobs.get(file.localBlobRef);
    if (!blobRow) {
      await db.drive_files.update(file.id, { syncStatus: "failed" });
      failedFileIds.push(file.id);
      continue;
    }
    const fd = new FormData();
    fd.append(
      "meta",
      JSON.stringify({
        clientFileId: file.id,
        clientFolderId: file.folderId,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksum: file.checksum,
        updatedAt: file.updatedAt,
      }),
    );
    fd.append("file", new File([blobRow.blob], file.name, { type: file.mimeType || blobRow.blob.type || "application/octet-stream" }));
    const res = await fetch("/api/drive/files/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      await db.drive_files.update(file.id, { syncStatus: "failed" });
      failedFileIds.push(file.id);
      continue;
    }
    const data = (await res.json()) as { cloudId: string; storageId: string };
    await db.drive_files.update(file.id, {
      syncStatus: "synced",
      cloudId: data.cloudId,
      cloudStorageId: data.storageId,
      updatedAt: Date.now(),
    });
    filesSynced++;
  }

  return { foldersSynced, filesSynced, failedFileIds };
}

export async function pullDriveFromCloud(token: string): Promise<{
  createdFolders: number;
  pulledFiles: number;
  downgradedFolders: number;
  downgradedFiles: number;
}> {
  const [folderRes, fileRes] = await Promise.all([
    fetch("/api/drive/folders", { headers: { Authorization: `Bearer ${token}` } }),
    fetch("/api/drive/files", { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!folderRes.ok || !fileRes.ok) throw new Error("拉取云盘数据失败");
  const { items: cloudFolders } = (await folderRes.json()) as { items: CloudFolderPayload[] };
  const { items: cloudFiles } = (await fileRes.json()) as { items: CloudFilePayload[] };
  const cloudFolderIdSet = new Set(cloudFolders.map((x) => x.clientFolderId));
  const cloudFileIdSet = new Set(cloudFiles.map((x) => x.clientFileId));
  let downgradedFolders = 0;
  let downgradedFiles = 0;

  const localFolders = await db.drive_folders.toArray();
  for (const local of localFolders) {
    const wasFromCloud = local.syncStatus === "synced" || !!local.cloudId;
    if (wasFromCloud && !cloudFolderIdSet.has(local.id)) {
      await db.drive_folders.update(local.id, {
        syncStatus: "local_only",
        cloudId: undefined,
        updatedAt: Date.now(),
      });
      downgradedFolders++;
    }
  }

  const localFiles = await db.drive_files.toArray();
  for (const local of localFiles) {
    const wasFromCloud = local.syncStatus === "synced" || !!local.cloudId;
    if (wasFromCloud && !cloudFileIdSet.has(local.id)) {
      await db.drive_files.update(local.id, {
        syncStatus: "local_only",
        cloudId: undefined,
        cloudStorageId: undefined,
        updatedAt: Date.now(),
      });
      downgradedFiles++;
    }
  }

  let createdFolders = 0;
  for (const folder of cloudFolders) {
    const local = await db.drive_folders.get(folder.clientFolderId);
    const row = {
      id: folder.clientFolderId,
      name: folder.name,
      parentId: folder.parentId,
      path: folder.path,
      createdAt: local?.createdAt ?? folder.updatedAt,
      updatedAt: folder.updatedAt,
      syncStatus: "synced" as const,
      cloudId: folder.cloudId,
    };
    if (!local) createdFolders++;
    await db.drive_folders.put(row);
  }

  let pulledFiles = 0;
  for (const remote of cloudFiles) {
    const local = await db.drive_files.get(remote.clientFileId);
    if (!local || remote.updatedAt >= local.updatedAt) {
      const blob = await downloadCloudFileBlob(token, remote.cloudId);
      const blobKey = local?.localBlobRef ?? createId("blob");
      await db.blobs.put({ key: blobKey, blob });
      await db.drive_files.put({
        id: remote.clientFileId,
        folderId: remote.clientFolderId,
        name: remote.name,
        mimeType: remote.mimeType,
        sizeBytes: remote.sizeBytes,
        checksum: remote.checksum,
        localBlobRef: blobKey,
        cloudStorageId: remote.storageId,
        createdAt: local?.createdAt ?? remote.updatedAt,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledFiles++;
    }
  }
  return { createdFolders, pulledFiles, downgradedFolders, downgradedFiles };
}
