import axios from "axios";

import { useAuthStore } from "@/stores/useAuthStore";

export const request = axios.create({
  baseURL: "/api",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

request.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        useAuthStore.getState().logout();
      }
      const serverMsg =
        (error.response?.data as { message?: string } | undefined)?.message ??
        error.message;
      return Promise.reject(new Error(serverMsg));
    }
    return Promise.reject(error);
  },
);
