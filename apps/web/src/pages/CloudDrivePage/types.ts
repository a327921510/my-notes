export type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  path?: string;
  createdAt: number;
  updatedAt: number;
};

export type DriveFile = {
  id: string;
  folderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  localBlobRef?: string;
  localPath?: string;
  createdAt: number;
  updatedAt: number;
};
