export const SITE_PROJECT_BACKUP_VERSION = 1 as const;

export type SiteProjectBackupItem = {
  name: string;
  content: string;
};

export type SiteProjectBackupProject = {
  name: string;
  items: SiteProjectBackupItem[];
};

export type SiteProjectBackupSite = {
  name: string;
  address: string;
  /** 与本地项目通过名称匹配；为 null 表示不关联项目 */
  projectName: string | null;
  items: SiteProjectBackupItem[];
};

export type SiteProjectBackupPayload = {
  formatVersion: typeof SITE_PROJECT_BACKUP_VERSION;
  exportedAt: number;
  projects: SiteProjectBackupProject[];
  sites: SiteProjectBackupSite[];
};

export type SiteProjectImportStats = {
  projectsCreated: number;
  sitesCreated: number;
  projectItemsAdded: number;
  siteItemsAdded: number;
  projectItemsSkipped: number;
  siteItemsSkipped: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isItem(v: unknown): v is SiteProjectBackupItem {
  if (!isRecord(v)) return false;
  return typeof v.name === "string" && typeof v.content === "string";
}

function isProject(v: unknown): v is SiteProjectBackupProject {
  if (!isRecord(v)) return false;
  if (typeof v.name !== "string") return false;
  if (!Array.isArray(v.items)) return false;
  return v.items.every(isItem);
}

function isSite(v: unknown): v is SiteProjectBackupSite {
  if (!isRecord(v)) return false;
  if (typeof v.name !== "string" || typeof v.address !== "string") return false;
  const pn = v.projectName;
  if (pn !== null && pn !== undefined && typeof pn !== "string") return false;
  if (!Array.isArray(v.items)) return false;
  return v.items.every(isItem);
}

export function parseSiteProjectPayload(raw: string): SiteProjectBackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON 解析失败");
  }
  if (!isRecord(parsed)) {
    throw new Error("备份文件根节点必须为 JSON 对象");
  }
  if (parsed.formatVersion !== SITE_PROJECT_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(parsed.formatVersion)}`);
  }
  if (!Array.isArray(parsed.projects) || !parsed.projects.every(isProject)) {
    throw new Error("备份文件中的 projects 字段无效");
  }
  if (!Array.isArray(parsed.sites) || !parsed.sites.every(isSite)) {
    throw new Error("备份文件中的 sites 字段无效");
  }
  if (typeof parsed.exportedAt !== "number" || !Number.isFinite(parsed.exportedAt)) {
    throw new Error("备份文件缺少有效的 exportedAt");
  }
  return {
    formatVersion: SITE_PROJECT_BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    projects: parsed.projects,
    sites: parsed.sites.map((s) => ({
      ...s,
      projectName: s.projectName === undefined || s.projectName === "" ? null : s.projectName,
    })),
  };
}

export function normProjectName(name: string): string {
  return name.trim();
}

export function siteDedupKey(name: string, address: string): string {
  return `${normProjectName(name)}\u0000${address.trim()}`;
}

export function itemDedupKey(name: string, content: string): string {
  return `${name.trim()}\u0000${content}`;
}
