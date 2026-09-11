import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { mkdir } from "node:fs/promises";

import { config, isProduction } from "./config.js";
import { createDatabase } from "./db/client.js";
import { registerErrorHandler } from "./errors.js";
import { createRequireAuth } from "./plugins/auth.js";
import { createDriveRepository } from "./repository/drive.js";
import { createUserRepository } from "./repository/users.js";
import { registerArchiveRoutes } from "./routes/archive.js";
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from "./routes/auth.js";
import { registerDocRoutes } from "./routes/docs.js";
import { registerDriveRoutes } from "./routes/drive.js";

async function main(): Promise<void> {
  if (isProduction && !process.env.JWT_SECRET) {
    throw new Error("生产环境必须设置 JWT_SECRET");
  }

  await mkdir(config.uploadDir, { recursive: true });
  const { db, sqlite } = createDatabase();
  const users = createUserRepository(db);
  const drive = createDriveRepository(db);

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
  registerErrorHandler(app);

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });
  // 导入包可能远大于单文件上限，这里放宽到上限的 5 倍
  await app.register(multipart, { limits: { fileSize: config.maxFileSizeBytes * 5 } });

  app.addHook("onClose", () => {
    sqlite.close();
  });

  app.get("/api/health", async () => ({ ok: true }));
  await registerPublicAuthRoutes(app, { users, drive });

  // 其余路由统一在带鉴权 hook 的作用域内注册，userId 只来自 token
  await app.register(async (guarded) => {
    guarded.addHook("preHandler", createRequireAuth(users));
    await registerProtectedAuthRoutes(guarded, { users });
    await registerDriveRoutes(guarded, { drive });
    await registerDocRoutes(guarded, { drive });
    await registerArchiveRoutes(guarded, { drive });
  });

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`API ready on http://${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
