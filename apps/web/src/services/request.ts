import { API_ERROR_MESSAGES, type ApiErrorBody, ApiErrorCode } from "@my-notes/shared";
import axios, { type AxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/useAuthStore";

/** 携带业务错误码的前端错误，供调用方按 code 接管（如同名冲突、基版本过期）。 */
export class RequestError extends Error {
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    this.details = details;
  }
}

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : "/api",
  timeout: 120_000,
});

request.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const body = error.response?.data as ApiErrorBody | undefined;
    const code = body?.code ?? ApiErrorCode.BAD_REQUEST;

    // 会话失效统一清理并跳登录，不让各页面各写一套
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    const message =
      body?.message ??
      API_ERROR_MESSAGES[code] ??
      (error.code === "ECONNABORTED" ? "请求超时，请重试" : "网络异常，请检查后端是否已启动");
    return Promise.reject(new RequestError(code, message, body?.details));
  },
);

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await request.get<T>(url, config);
  return response.data;
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await request.post<T>(url, data, config);
  return response.data;
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await request.put<T>(url, data, config);
  return response.data;
}

export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await request.patch<T>(url, data, config);
  return response.data;
}
