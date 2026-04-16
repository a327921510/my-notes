import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export const BCRYPT_COST = 10;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stable user id derived from normalized email (matches legacy dev login shape). */
export function userIdFromNormalizedEmail(emailNormalized: string): string {
  return `u_${Buffer.from(emailNormalized, "utf8").toString("hex").slice(0, 16)}`;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
