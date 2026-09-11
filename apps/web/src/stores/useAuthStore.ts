import type { AuthUser } from "@my-notes/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  /** 会话过期时置位，登录页据此给出提示 */
  expired: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  clearExpired: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expired: false,
      setAuth: (token, user) => set({ token, user, expired: false }),
      logout: () => set({ token: null, user: null, expired: get().token !== null }),
      clearExpired: () => set({ expired: false }),
    }),
    {
      name: "mydrive-auth-v1",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
