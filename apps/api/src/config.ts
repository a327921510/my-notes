import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: readInt("PORT", 3001),
  jwtSecret: process.env.JWT_SECRET ?? "dev-my-drive-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  databaseFile: process.env.DATABASE_FILE ?? path.join(appRoot, "data", "app.db"),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(appRoot, "uploads"),
  maxFileSizeBytes: readInt("MAX_FILE_SIZE_BYTES", 200 * 1024 * 1024),
  userQuotaBytes: readInt("USER_QUOTA_BYTES", 5 * 1024 * 1024 * 1024),
} as const;

export const isProduction = process.env.NODE_ENV === "production";
