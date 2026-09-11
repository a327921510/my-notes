import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { DrizzleDB } from "../db/client.js";
import { users } from "../db/schema.js";

export type UserRow = typeof users.$inferSelect;

export function createUserRepository(db: DrizzleDB) {
  return {
    findByEmailNormalized(emailNormalized: string): UserRow | undefined {
      return db.select().from(users).where(eq(users.emailNormalized, emailNormalized)).get();
    },

    findById(id: string): UserRow | undefined {
      return db.select().from(users).where(eq(users.id, id)).get();
    },

    create(input: { email: string; emailNormalized: string; passwordHash: string }): UserRow {
      const now = Date.now();
      const row: UserRow = {
        id: randomUUID(),
        email: input.email,
        emailNormalized: input.emailNormalized,
        passwordHash: input.passwordHash,
        passwordVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(users).values(row).run();
      return row;
    },

    /** 改密码时自增 passwordVersion，令携带旧版本号的 token 失效。 */
    updatePassword(id: string, passwordHash: string, nextVersion: number): void {
      db.update(users)
        .set({ passwordHash, passwordVersion: nextVersion, updatedAt: Date.now() })
        .where(eq(users.id, id))
        .run();
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
