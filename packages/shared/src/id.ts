/** Client-side id with stable prefix for debugging (crypto.randomUUID). */
export function createId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
