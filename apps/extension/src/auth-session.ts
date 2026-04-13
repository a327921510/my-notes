const TOKEN_KEY = "my_notes_token";
const USER_KEY = "my_notes_user";

export interface AuthUser {
  id: string;
  email: string;
}

export async function readSession(): Promise<{ token: string | null; user: AuthUser | null }> {
  const raw = await chrome.storage.session.get([TOKEN_KEY, USER_KEY]);
  const token = (raw[TOKEN_KEY] as string | undefined) ?? null;
  let user: AuthUser | null = null;
  const u = raw[USER_KEY];
  if (typeof u === "string") {
    try {
      user = JSON.parse(u) as AuthUser;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

export async function writeSession(token: string, user: AuthUser): Promise<void> {
  await chrome.storage.session.set({
    [TOKEN_KEY]: token,
    [USER_KEY]: JSON.stringify(user),
  });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove([TOKEN_KEY, USER_KEY]);
}
