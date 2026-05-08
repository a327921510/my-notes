import { db, type NotesDB } from "@my-notes/local-db";
import {
  buildProjectCredentialMirrorItemName,
  createId,
  nextSyncAfterEdit,
  projectCredentialMirrorNamesPrefix,
  type ProjectCredentialMirrorKind,
} from "@my-notes/shared";

import { segmentProjectMarkdownWithCredentialTables } from "./segmentProjectMarkdown";

function normalizeSiteAddress(address: string): string {
  return address.trim().toLowerCase();
}

function deriveSiteLabelFromAddress(address: string): string {
  const raw = address.trim();
  if (!raw) return "站点";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname || raw.slice(0, 48);
  } catch {
    return raw.slice(0, 48);
  }
}

async function findOrCreateSiteForProjectAddress(
  dexie: NotesDB,
  projectId: string,
  addressRaw: string,
): Promise<string> {
  const address = addressRaw.trim();
  const norm = normalizeSiteAddress(address);
  const sites = await dexie.sites.toArray();
  const match =
    sites.find(
      (s) => normalizeSiteAddress(s.address) === norm && (s.projectId ?? null) === projectId,
    ) ?? sites.find((s) => normalizeSiteAddress(s.address) === norm);
  if (match) return match.id;

  const siteId = createId("site");
  await dexie.sites.add({
    id: siteId,
    name: deriveSiteLabelFromAddress(address),
    address,
    projectId,
    updatedAt: Date.now(),
    version: 1,
    syncStatus: "local_only",
  });
  return siteId;
}

type MirrorUpsert = {
  name: string;
  siteId: string;
  content: string;
  projectId: string | undefined;
};

/**
 * 根据项目文档中的「地址/账号/密码/备注」表，在对应站点下维护只读镜像条目（name 以 `__pm_cred_mirror__` 为前缀）。
 */
export async function syncProjectCredentialMirrors(projectId: string, markdown: string): Promise<void> {
  const upserts: MirrorUpsert[] = [];
  const segments = segmentProjectMarkdownWithCredentialTables(markdown);
  let credentialTableIndex = 0;
  for (const seg of segments) {
    if (seg.type !== "credentialTable") continue;
    const ctIdx = credentialTableIndex;
    credentialTableIndex += 1;
    for (let rowIndex = 0; rowIndex < seg.body.length; rowIndex++) {
      const row = seg.body[rowIndex] ?? [];
      const addr = (row[0] ?? "").trim();
      const acc = (row[1] ?? "").trim();
      const pwd = (row[2] ?? "").trim();
      const remark = (row[3] ?? "").trim();
      if (!addr || (!acc && !pwd)) continue;

      const siteId = await findOrCreateSiteForProjectAddress(db, projectId, addr);
      const site = await db.sites.get(siteId);
      const itemProjectId = (site?.projectId ?? projectId) || undefined;
      const remarkLine = remark ? `\n备注：${remark}` : "";

      const pushKind = (kind: ProjectCredentialMirrorKind, body: string) => {
        upserts.push({
          name: buildProjectCredentialMirrorItemName(projectId, ctIdx, rowIndex, kind),
          siteId,
          content: body + remarkLine,
          projectId: itemProjectId,
        });
      };
      if (acc) pushKind("acc", acc);
      if (pwd) pushKind("pwd", pwd);
    }
  }

  const prefix = projectCredentialMirrorNamesPrefix(projectId);
  const desiredNames = new Set(upserts.map((u) => u.name));

  await db.transaction("rw", db.sites, db.site_items, async () => {
    const existingMirror = await db.site_items.filter((it) => it.name.startsWith(prefix)).toArray();
    for (const row of existingMirror) {
      if (!desiredNames.has(row.name)) {
        await db.site_items.delete(row.id);
      }
    }

    for (const u of upserts) {
      const cur = await db.site_items.where("name").equals(u.name).first();
      if (cur) {
        const patch: {
          siteId?: string;
          content?: string;
          projectId?: string | null;
          updatedAt: number;
          syncStatus: ReturnType<typeof nextSyncAfterEdit>;
        } = {
          updatedAt: Date.now(),
          syncStatus: nextSyncAfterEdit(cur.syncStatus),
        };
        let changed = false;
        if (cur.siteId !== u.siteId) {
          patch.siteId = u.siteId;
          changed = true;
        }
        if (cur.content !== u.content) {
          patch.content = u.content;
          changed = true;
        }
        const nextPid = u.projectId ?? null;
        if ((cur.projectId ?? null) !== nextPid) {
          patch.projectId = nextPid ?? undefined;
          changed = true;
        }
        if (changed) {
          await db.site_items.update(cur.id, patch);
        }
      } else {
        await db.site_items.add({
          id: createId("item"),
          siteId: u.siteId,
          projectId: u.projectId,
          name: u.name,
          content: u.content,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
      }
    }
  });
}
