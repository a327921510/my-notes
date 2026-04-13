/** Relative `/api/...` when `apiBase` empty (browser same-origin); else absolute `${apiBase}/api/...` (extension). */
export function joinApiPath(apiBase: string | undefined, apiPath: string): string {
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (apiBase == null || apiBase === "") return p;
  return `${apiBase.replace(/\/$/, "")}${p}`;
}

export type SyncClientOptions = {
  /** e.g. `http://127.0.0.1:3001` for MV3 extension; omit for Vite dev same-origin Web. */
  apiBase?: string;
};
