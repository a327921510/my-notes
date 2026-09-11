import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";

export type StoredObject = {
  storageId: string;
  sizeBytes: number;
  checksum: string;
};

function objectPath(userId: string, storageId: string): string {
  return path.join(config.uploadDir, userId, storageId);
}

export function checksumOf(buffer: Buffer): string {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

/** 按账号分目录落盘，下载时再校验归属，不提供任何公开直链。 */
export async function writeObject(userId: string, buffer: Buffer): Promise<StoredObject> {
  const storageId = randomUUID();
  const dest = objectPath(userId, storageId);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return { storageId, sizeBytes: buffer.byteLength, checksum: checksumOf(buffer) };
}

export async function readObject(userId: string, storageId: string): Promise<Buffer> {
  return readFile(objectPath(userId, storageId));
}

export function openObjectStream(userId: string, storageId: string) {
  return createReadStream(objectPath(userId, storageId));
}

export async function deleteObject(userId: string, storageId: string): Promise<void> {
  await rm(objectPath(userId, storageId), { force: true });
}
