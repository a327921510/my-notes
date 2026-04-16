export type StoredUser = {
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: number;
};

export type StoredNoteImage = {
  clientImageId: string;
  storageId: string;
  checksum?: string;
};

export type StoredNote = {
  userId: string;
  clientNoteId: string;
  cloudId: string;
  title: string;
  contentText: string;
  updatedAt: number;
  images: StoredNoteImage[];
};

export type StoredSnippet = {
  userId: string;
  clientSnippetId: string;
  cloudId: string;
  type: string;
  content: string;
  sourceDomain: string;
  sourceUrl?: string;
  updatedAt: number;
};

export type StoredSite = {
  userId: string;
  clientSiteId: string;
  cloudId: string;
  name: string;
  address: string;
  version: number;
  updatedAt: number;
};

export type StoredSiteItem = {
  userId: string;
  clientItemId: string;
  clientSiteId: string;
  cloudId: string;
  name: string;
  content: string;
  updatedAt: number;
};

export type StoredDriveFolder = {
  userId: string;
  clientFolderId: string;
  cloudId: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
};

export type StoredDriveFile = {
  userId: string;
  clientFileId: string;
  clientFolderId: string;
  cloudId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  storageId: string;
  updatedAt: number;
};

/**
 * Repository interface that abstracts persistence.
 * Implement this for SQLite, PostgreSQL, or any other backend.
 */
export type Repository = {
  /* ── Users (auth) ──────────────────────────────────────────── */
  findUserByEmailNormalized(emailNormalized: string): StoredUser | undefined;
  createUser(user: StoredUser): void;

  /* ── Notes ─────────────────────────────────────────────────── */
  getNoteByCloudId(cloudId: string): StoredNote | undefined;
  listNotesByUser(userId: string): StoredNote[];
  upsertNote(note: StoredNote): void;
  deleteNote(cloudId: string): void;

  /* ── Snippets ──────────────────────────────────────────────── */
  getSnippetByCloudId(cloudId: string): StoredSnippet | undefined;
  listSnippetsByUser(userId: string): StoredSnippet[];
  upsertSnippet(snippet: StoredSnippet): void;
  deleteSnippet(cloudId: string): void;

  /* ── Sites ─────────────────────────────────────────────────── */
  getSiteByCloudId(cloudId: string): StoredSite | undefined;
  listSitesByUser(userId: string): StoredSite[];
  findDuplicateSite(
    userId: string,
    excludeClientSiteId: string,
    name: string,
    address: string,
  ): StoredSite | undefined;
  upsertSite(site: StoredSite): void;
  deleteSite(cloudId: string): void;

  /* ── Site Items ────────────────────────────────────────────── */
  getSiteItemByCloudId(cloudId: string): StoredSiteItem | undefined;
  listSiteItemsByUser(userId: string): StoredSiteItem[];
  upsertSiteItem(item: StoredSiteItem): void;
  deleteSiteItem(cloudId: string): void;
  deleteSiteItemsByUserAndSite(userId: string, clientSiteId: string): void;

  /* ── Drive Folders ─────────────────────────────────────────── */
  listDriveFoldersByUser(userId: string): StoredDriveFolder[];
  upsertDriveFolder(folder: StoredDriveFolder): void;

  /* ── Drive Files ───────────────────────────────────────────── */
  getDriveFileByCloudId(cloudId: string): StoredDriveFile | undefined;
  listDriveFilesByUser(userId: string): StoredDriveFile[];
  upsertDriveFile(file: StoredDriveFile): void;
  deleteDriveFile(cloudId: string): void;

  /* ── File Ownership ────────────────────────────────────────── */
  getFileOwner(storageId: string): string | undefined;
  setFileOwner(storageId: string, userId: string): void;
  deleteFileOwner(storageId: string): void;

  /* ── Lifecycle ─────────────────────────────────────────────── */
  close(): void;
};
