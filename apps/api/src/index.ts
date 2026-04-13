import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

interface UserPayload {
  sub: string;
  email: string;
}

interface NoteImage {
  clientImageId: string;
  storageId: string;
  checksum?: string;
}

interface StoredNote {
  userId: string;
  clientNoteId: string;
  cloudId: string;
  title: string;
  contentText: string;
  updatedAt: number;
  images: NoteImage[];
}

interface StoredSite {
  userId: string;
  clientSiteId: string;
  cloudId: string;
  name: string;
  address: string;
  version: number;
  updatedAt: number;
}

interface StoredSiteItem {
  userId: string;
  clientItemId: string;
  clientSiteId: string;
  cloudId: string;
  name: string;
  content: string;
  updatedAt: number;
}

interface StoredDriveFolder {
  userId: string;
  clientFolderId: string;
  cloudId: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
}

interface StoredDriveFile {
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
}

async function saveUserFile(userId: string, buffer: Buffer, ext: string): Promise<string> {
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const dest = path.join(UPLOAD_ROOT, name);
  await writeFile(dest, buffer);
  fileOwners.set(name, userId);
  return name;
}

const fileOwners = new Map<string, string>();

async function removeNoteFiles(note: StoredNote | undefined): Promise<void> {
  if (!note) return;
  for (const img of note.images) {
    const p = path.join(UPLOAD_ROOT, img.storageId);
    await unlink(p).catch(() => {});
    fileOwners.delete(img.storageId);
  }
}

async function removeStoredFile(storageId: string): Promise<void> {
  const p = path.join(UPLOAD_ROOT, storageId);
  await unlink(p).catch(() => {});
  fileOwners.delete(storageId);
}

async function main() {
  await mkdir(UPLOAD_ROOT, { recursive: true });

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-my-notes-secret-change-me" });
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });

  const notes = new Map<string, StoredNote>();
  const sites = new Map<string, StoredSite>();
  const siteItems = new Map<string, StoredSiteItem>();
  const driveFolders = new Map<string, StoredDriveFolder>();
  const driveFiles = new Map<string, StoredDriveFile>();

  const snippets = new Map<
    string,
    {
      userId: string;
      clientSnippetId: string;
      cloudId: string;
      type: string;
      content: string;
      sourceDomain: string;
      sourceUrl?: string;
      updatedAt: number;
    }
  >();

  app.post<{ Body: { email: string; password: string } }>("/api/auth/login", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return reply.status(400).send({ message: "缺少邮箱或密码" });
    }
    if (process.env.NODE_ENV === "production" && password !== "demo") {
      return reply.status(401).send({ message: "请使用密码 demo（MVP 演示）" });
    }
    const userId = `u_${Buffer.from(email).toString("hex").slice(0, 16)}`;
    const token = await reply.jwtSign({ sub: userId, email } as UserPayload);
    return { token, user: { id: userId, email } };
  });

  app.addHook("preHandler", async (req, reply) => {
    if (
      req.url.startsWith("/api/upload") ||
      req.url.startsWith("/api/notes") ||
      req.url.startsWith("/api/snippets") ||
      req.url.startsWith("/api/sites") ||
      req.url.startsWith("/api/site-items") ||
      req.url.startsWith("/api/drive") ||
      req.url.startsWith("/api/files/")
    ) {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ message: "未授权" });
      }
    }
  });

  /** 单图上传（返回 storageId，非公开 URL） */
  app.post("/api/upload/image", async (req, reply) => {
    const user = req.user as UserPayload;
    const data = await req.file();
    if (!data) return reply.status(400).send({ message: "缺少文件" });
    const ext = path.extname(data.filename || "") || ".bin";
    const buffer = await data.toBuffer();
    const storageId = await saveUserFile(user.sub, buffer, ext);
    return { storageId };
  });

  /** 笔记推送：multipart，meta(JSON) + img_<clientImageId> 二进制流 */
  app.post("/api/notes/push", async (req, reply) => {
    const user = req.user as UserPayload;
    const parts = req.parts();
    let metaStr = "";
    const fileBuffers = new Map<string, Buffer>();

    for await (const part of parts) {
      if (part.type === "file") {
        const m = /^img_(.+)$/.exec(part.fieldname);
        if (m) {
          fileBuffers.set(m[1], await part.toBuffer());
        }
      } else if (part.type === "field" && part.fieldname === "meta") {
        metaStr = String(part.value);
      }
    }

    if (!metaStr) {
      return reply.status(400).send({ message: "缺少 meta" });
    }

    let meta: {
      clientNoteId: string;
      title: string;
      contentText: string;
      updatedAt: number;
      images: { clientImageId: string; checksum?: string }[];
    };
    try {
      meta = JSON.parse(metaStr) as typeof meta;
    } catch {
      return reply.status(400).send({ message: "meta 不是合法 JSON" });
    }

    const cloudId = `cn_${meta.clientNoteId}`;
    const existing = notes.get(cloudId);
    if (existing && existing.userId !== user.sub) {
      return reply.status(403).send({ message: "无权覆盖该笔记" });
    }
    if (existing?.userId === user.sub) {
      await removeNoteFiles(existing);
    }

    const imagePayload: NoteImage[] = [];
    for (const img of meta.images ?? []) {
      const buf = fileBuffers.get(img.clientImageId);
      if (!buf) {
        return reply.status(400).send({ message: `缺少图片二进制: ${img.clientImageId}` });
      }
      const ext = ".bin";
      const storageId = await saveUserFile(user.sub, buf, ext);
      imagePayload.push({
        clientImageId: img.clientImageId,
        storageId,
        checksum: img.checksum,
      });
    }

    notes.set(cloudId, {
      userId: user.sub,
      clientNoteId: meta.clientNoteId,
      cloudId,
      title: meta.title,
      contentText: meta.contentText,
      updatedAt: meta.updatedAt,
      images: imagePayload,
    });

    return {
      cloudId,
      images: imagePayload.map((i) => ({ clientImageId: i.clientImageId, storageId: i.storageId })),
    };
  });

  app.get("/api/notes", async (req) => {
    const user = req.user as UserPayload;
    const items = [...notes.values()]
      .filter((n) => n.userId === user.sub)
      .map((n) => ({
        cloudId: n.cloudId,
        clientNoteId: n.clientNoteId,
        title: n.title,
        contentText: n.contentText,
        updatedAt: n.updatedAt,
        images: n.images,
      }));
    return { items };
  });

  app.delete<{ Params: { clientNoteId: string } }>("/api/notes/:clientNoteId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { clientNoteId } = req.params;
    const cloudId = `cn_${clientNoteId}`;
    const n = notes.get(cloudId);
    if (!n || n.userId !== user.sub) {
      return reply.status(404).send({ message: "未找到云端笔记" });
    }
    await removeNoteFiles(n);
    notes.delete(cloudId);
    return { ok: true };
  });

  app.get<{ Params: { storageId: string } }>("/api/files/:storageId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { storageId } = req.params;
    if (!/^[a-zA-Z0-9_.-]+$/.test(storageId)) {
      return reply.status(400).send({ message: "非法 storageId" });
    }
    const owner = fileOwners.get(storageId);
    if (!owner || owner !== user.sub) {
      return reply.status(404).send({ message: "文件不存在" });
    }
    const filePath = path.join(UPLOAD_ROOT, storageId);
    return reply.send(createReadStream(filePath));
  });

  app.post<{
    Body: {
      clientSnippetId: string;
      type: string;
      content: string;
      sourceDomain: string;
      sourceUrl?: string;
      updatedAt: number;
    };
  }>("/api/snippets/upsert", async (req) => {
    const user = req.user as UserPayload;
    const b = req.body;
    const cloudId = `cs_${b.clientSnippetId}`;
    snippets.set(cloudId, {
      userId: user.sub,
      clientSnippetId: b.clientSnippetId,
      cloudId,
      type: b.type,
      content: b.content,
      sourceDomain: b.sourceDomain,
      sourceUrl: b.sourceUrl,
      updatedAt: b.updatedAt,
    });
    return { cloudId };
  });

  app.get("/api/snippets", async (req) => {
    const user = req.user as UserPayload;
    const items = [...snippets.values()]
      .filter((s) => s.userId === user.sub)
      .map((s) => ({
        cloudId: s.cloudId,
        clientSnippetId: s.clientSnippetId,
        type: s.type,
        content: s.content,
        sourceDomain: s.sourceDomain,
        sourceUrl: s.sourceUrl,
        updatedAt: s.updatedAt,
      }));
    return { items };
  });

  app.delete<{ Params: { clientSnippetId: string } }>("/api/snippets/:clientSnippetId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { clientSnippetId } = req.params;
    const cloudId = `cs_${clientSnippetId}`;
    const s = snippets.get(cloudId);
    if (!s || s.userId !== user.sub) {
      return reply.status(404).send({ message: "未找到云端短文本" });
    }
    snippets.delete(cloudId);
    return { ok: true };
  });

  app.post<{
    Body: {
      clientSiteId: string;
      name: string;
      address: string;
      updatedAt: number;
    };
  }>("/api/sites/upsert", async (req, reply) => {
    const user = req.user as UserPayload;
    const b = req.body;
    if (!b?.clientSiteId) return reply.status(400).send({ message: "缺少 clientSiteId" });
    const nextName = (b.name ?? "").trim();
    const nextAddress = (b.address ?? "").trim();
    if (!nextName || !nextAddress) {
      return reply.status(400).send({ message: "站点名称和地址不能为空" });
    }
    const duplicated = [...sites.values()].find(
      (s) =>
        s.userId === user.sub &&
        s.clientSiteId !== b.clientSiteId &&
        s.name.trim().toLowerCase() === nextName.toLowerCase() &&
        s.address.trim().toLowerCase() === nextAddress.toLowerCase(),
    );
    if (duplicated) {
      return reply.status(409).send({ message: "站点名称和地址组合已存在" });
    }
    const cloudId = `st_${b.clientSiteId}`;
    sites.set(cloudId, {
      userId: user.sub,
      clientSiteId: b.clientSiteId,
      cloudId,
      name: nextName,
      address: nextAddress,
      version: 1,
      updatedAt: b.updatedAt ?? Date.now(),
    });
    return { cloudId, version: 1 };
  });

  app.post<{
    Body: {
      clientSiteId: string;
      name: string;
      address: string;
      expectedVersion: number;
      updatedAt: number;
      items: { clientItemId: string; name: string; content: string; updatedAt: number }[];
    };
  }>("/api/sites/push-full", async (req, reply) => {
    const user = req.user as UserPayload;
    const b = req.body;
    if (!b?.clientSiteId) return reply.status(400).send({ message: "缺少 clientSiteId" });
    const nextName = (b.name ?? "").trim();
    const nextAddress = (b.address ?? "").trim();
    if (!nextName || !nextAddress) {
      return reply.status(400).send({ message: "站点名称和地址不能为空" });
    }
    const duplicated = [...sites.values()].find(
      (s) =>
        s.userId === user.sub &&
        s.clientSiteId !== b.clientSiteId &&
        s.name.trim().toLowerCase() === nextName.toLowerCase() &&
        s.address.trim().toLowerCase() === nextAddress.toLowerCase(),
    );
    if (duplicated) {
      return reply.status(409).send({ message: "站点名称和地址组合已存在" });
    }

    const cloudId = `st_${b.clientSiteId}`;
    const existing = sites.get(cloudId);
    const remoteVersion = existing?.version ?? 1;
    if (Number(b.expectedVersion ?? 1) !== remoteVersion) {
      return reply.status(409).send({ message: "版本不一致，请先拉取云端数据" });
    }
    const nextVersion = remoteVersion + 1;
    sites.set(cloudId, {
      userId: user.sub,
      clientSiteId: b.clientSiteId,
      cloudId,
      name: nextName,
      address: nextAddress,
      version: nextVersion,
      updatedAt: b.updatedAt ?? Date.now(),
    });

    for (const [key, value] of [...siteItems.entries()]) {
      if (value.userId === user.sub && value.clientSiteId === b.clientSiteId) {
        siteItems.delete(key);
      }
    }
    for (const item of b.items ?? []) {
      if (!item?.clientItemId) continue;
      const itemCloudId = `si_${item.clientItemId}`;
      siteItems.set(itemCloudId, {
        userId: user.sub,
        clientItemId: item.clientItemId,
        clientSiteId: b.clientSiteId,
        cloudId: itemCloudId,
        name: item.name ?? "",
        content: item.content ?? "",
        updatedAt: item.updatedAt ?? Date.now(),
      });
    }
    return { cloudId, version: nextVersion };
  });

  app.get("/api/sites", async (req) => {
    const user = req.user as UserPayload;
    const items = [...sites.values()]
      .filter((s) => s.userId === user.sub)
      .map((s) => ({
        cloudId: s.cloudId,
        clientSiteId: s.clientSiteId,
        name: s.name,
        address: s.address,
        version: s.version ?? 1,
        updatedAt: s.updatedAt,
      }));
    return { items };
  });

  app.delete<{ Params: { clientSiteId: string } }>("/api/sites/:clientSiteId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { clientSiteId } = req.params;
    const cloudId = `st_${clientSiteId}`;
    const s = sites.get(cloudId);
    if (!s || s.userId !== user.sub) {
      return reply.status(404).send({ message: "未找到云端站点" });
    }
    sites.delete(cloudId);
    for (const [key, value] of [...siteItems.entries()]) {
      if (value.userId === user.sub && value.clientSiteId === clientSiteId) {
        siteItems.delete(key);
      }
    }
    return { ok: true };
  });

  app.post<{
    Body: {
      clientItemId: string;
      clientSiteId: string;
      name: string;
      content: string;
      updatedAt: number;
    };
  }>("/api/site-items/upsert", async (req, reply) => {
    const user = req.user as UserPayload;
    const b = req.body;
    if (!b?.clientItemId) return reply.status(400).send({ message: "缺少 clientItemId" });
    if (!b?.clientSiteId) return reply.status(400).send({ message: "缺少 clientSiteId" });
    const cloudId = `si_${b.clientItemId}`;
    siteItems.set(cloudId, {
      userId: user.sub,
      clientItemId: b.clientItemId,
      clientSiteId: b.clientSiteId,
      cloudId,
      name: b.name ?? "",
      content: b.content ?? "",
      updatedAt: b.updatedAt ?? Date.now(),
    });
    return { cloudId };
  });

  app.get("/api/site-items", async (req) => {
    const user = req.user as UserPayload;
    const items = [...siteItems.values()]
      .filter((s) => s.userId === user.sub)
      .map((s) => ({
        cloudId: s.cloudId,
        clientItemId: s.clientItemId,
        clientSiteId: s.clientSiteId,
        name: s.name,
        content: s.content,
        updatedAt: s.updatedAt,
      }));
    return { items };
  });

  app.delete<{ Params: { clientItemId: string } }>("/api/site-items/:clientItemId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { clientItemId } = req.params;
    const cloudId = `si_${clientItemId}`;
    const it = siteItems.get(cloudId);
    if (!it || it.userId !== user.sub) {
      return reply.status(404).send({ message: "未找到云端站点条目" });
    }
    siteItems.delete(cloudId);
    return { ok: true };
  });

  app.post<{
    Body: {
      clientFolderId: string;
      name: string;
      parentId: string | null;
      path?: string;
      updatedAt: number;
    };
  }>("/api/drive/folders/upsert", async (req, reply) => {
    const user = req.user as UserPayload;
    const b = req.body;
    if (!b?.clientFolderId) return reply.status(400).send({ message: "缺少 clientFolderId" });
    const name = (b.name ?? "").trim();
    if (!name) return reply.status(400).send({ message: "目录名称不能为空" });
    const cloudId = `dfd_${b.clientFolderId}`;
    driveFolders.set(cloudId, {
      userId: user.sub,
      clientFolderId: b.clientFolderId,
      cloudId,
      name,
      parentId: b.parentId ?? null,
      path: b.path,
      updatedAt: b.updatedAt ?? Date.now(),
    });
    return { cloudId };
  });

  app.get("/api/drive/folders", async (req) => {
    const user = req.user as UserPayload;
    const items = [...driveFolders.values()]
      .filter((x) => x.userId === user.sub)
      .map((x) => ({
        cloudId: x.cloudId,
        clientFolderId: x.clientFolderId,
        name: x.name,
        parentId: x.parentId,
        path: x.path,
        updatedAt: x.updatedAt,
      }));
    return { items };
  });

  app.post("/api/drive/files/push", async (req, reply) => {
    const user = req.user as UserPayload;
    const parts = req.parts();
    let metaStr = "";
    let fileBuffer: Buffer | null = null;
    let fileExt = ".bin";

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "file") {
        fileBuffer = await part.toBuffer();
        fileExt = path.extname(part.filename || "") || ".bin";
      } else if (part.type === "field" && part.fieldname === "meta") {
        metaStr = String(part.value);
      }
    }
    if (!metaStr) return reply.status(400).send({ message: "缺少 meta" });
    if (!fileBuffer) return reply.status(400).send({ message: "缺少文件二进制" });

    let meta: {
      clientFileId: string;
      clientFolderId: string;
      name: string;
      mimeType?: string;
      sizeBytes: number;
      checksum?: string;
      updatedAt: number;
    };
    try {
      meta = JSON.parse(metaStr) as typeof meta;
    } catch {
      return reply.status(400).send({ message: "meta 不是合法 JSON" });
    }
    if (!meta.clientFileId || !meta.clientFolderId || !meta.name) {
      return reply.status(400).send({ message: "meta 字段不完整" });
    }

    const cloudId = `dff_${meta.clientFileId}`;
    const existing = driveFiles.get(cloudId);
    if (existing && existing.userId !== user.sub) {
      return reply.status(403).send({ message: "无权覆盖该文件" });
    }
    if (existing?.storageId) {
      await removeStoredFile(existing.storageId);
    }
    const storageId = await saveUserFile(user.sub, fileBuffer, fileExt);
    driveFiles.set(cloudId, {
      userId: user.sub,
      clientFileId: meta.clientFileId,
      clientFolderId: meta.clientFolderId,
      cloudId,
      name: meta.name,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      checksum: meta.checksum,
      storageId,
      updatedAt: meta.updatedAt ?? Date.now(),
    });
    return { cloudId, storageId };
  });

  app.get("/api/drive/files", async (req) => {
    const user = req.user as UserPayload;
    const items = [...driveFiles.values()]
      .filter((x) => x.userId === user.sub)
      .map((x) => ({
        cloudId: x.cloudId,
        clientFileId: x.clientFileId,
        clientFolderId: x.clientFolderId,
        name: x.name,
        mimeType: x.mimeType,
        sizeBytes: x.sizeBytes,
        checksum: x.checksum,
        storageId: x.storageId,
        updatedAt: x.updatedAt,
      }));
    return { items };
  });

  app.get<{ Params: { cloudId: string } }>("/api/drive/files/:cloudId/download", async (req, reply) => {
    const user = req.user as UserPayload;
    const cloudId = req.params.cloudId;
    const file = driveFiles.get(cloudId);
    if (!file || file.userId !== user.sub) {
      return reply.status(404).send({ message: "云端文件不存在" });
    }
    const filePath = path.join(UPLOAD_ROOT, file.storageId);
    reply.header("Content-Type", file.mimeType || "application/octet-stream");
    return reply.send(createReadStream(filePath));
  });

  app.delete<{ Params: { clientFileId: string } }>("/api/drive/files/:clientFileId", async (req, reply) => {
    const user = req.user as UserPayload;
    const { clientFileId } = req.params;
    const cloudId = `dff_${clientFileId}`;
    const file = driveFiles.get(cloudId);
    if (!file || file.userId !== user.sub) {
      return reply.status(404).send({ message: "云端文件不存在" });
    }
    await removeStoredFile(file.storageId);
    driveFiles.delete(cloudId);
    return { ok: true };
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
