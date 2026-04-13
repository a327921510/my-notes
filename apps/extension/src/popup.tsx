import type { SnippetRecord, SnippetType, SyncStatus } from "@my-notes/shared";
import {
  SNIPPET_TYPE_LABELS,
  SYNC_STATUS_LABELS,
  createId,
  needsUpload,
  nextSyncAfterEdit,
} from "@my-notes/shared";
import { db } from "@my-notes/local-db";
import { pullFromCloud, uploadSnippet } from "@my-notes/sync-client";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { clearSession, readSession, writeSession, type AuthUser } from "./auth-session";
import { migrateLegacySnippetsIfNeeded } from "./migrate-legacy";

const apiBase = import.meta.env.VITE_API_BASE;

function domainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function formatCaptureTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function Popup() {
  const [tabUrl, setTabUrl] = useState<string>("");
  const [tabTitle, setTabTitle] = useState<string>("");
  const [currentTabDomain, setCurrentTabDomain] = useState<string>("");
  const [type, setType] = useState<SnippetType>("account");
  const [content, setContent] = useState("");
  const [filterDomain, setFilterDomain] = useState<string>("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<SnippetType>("account");
  const [editContent, setEditContent] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("demo");
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const items = useLiveQuery(() => db.snippets.orderBy("updatedAt").reverse().toArray(), []) ?? [];

  const refreshActiveTab = useCallback(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      setTabUrl(t?.url ?? "");
      setTabTitle(t?.title ?? "");
      setCurrentTabDomain(domainFromUrl(t?.url));
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await migrateLegacySnippetsIfNeeded();
      const s = await readSession();
      setToken(s.token);
      setUser(s.user);
    })();
    void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      const url = t?.url ?? "";
      const title = t?.title ?? "";
      const d = domainFromUrl(t?.url);
      setTabUrl(url);
      setTabTitle(title);
      setCurrentTabDomain(d);
      setFilterDomain(d);
    });
  }, []);

  const domainFilter = filterDomain.trim().toLowerCase();

  const byDomain = useMemo(() => {
    if (!domainFilter) return items;
    return items.filter((s) => s.sourceDomain === domainFilter);
  }, [items, domainFilter]);

  const listRows = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return byDomain;
    return byDomain.filter((s) => {
      const typeLabel = SNIPPET_TYPE_LABELS[s.type].toLowerCase();
      return (
        s.content.toLowerCase().includes(kw) ||
        typeLabel.includes(kw) ||
        s.sourceDomain.includes(kw) ||
        (s.sourceTitle?.toLowerCase().includes(kw) ?? false) ||
        (s.sourceUrl?.toLowerCase().includes(kw) ?? false)
      );
    });
  }, [byDomain, searchKeyword]);

  const domainOptions = useMemo(() => {
    const set = new Set(items.map((s) => s.sourceDomain));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const handleLogin = useCallback(async () => {
    setAuthError(null);
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "登录失败");
      }
      const data = (await res.json()) as { token: string; user: AuthUser };
      await writeSession(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
      setSyncMsg("登录成功");
    } catch (e) {
      setAuthError((e as Error).message);
    }
  }, [email, password]);

  const handleLogout = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
    setSyncMsg(null);
  }, []);

  const handlePull = useCallback(async () => {
    if (!token) {
      setSyncMsg("请先登录");
      return;
    }
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const { notesApplied, snippetsApplied } = await pullFromCloud(db, token, { apiBase });
      setSyncMsg(`拉取完成：笔记 ${notesApplied}，短文本 ${snippetsApplied}`);
    } catch (e) {
      setSyncMsg(`拉取失败：${(e as Error).message}`);
    } finally {
      setSyncBusy(false);
    }
  }, [token]);

  const handlePush = useCallback(async () => {
    if (!token) {
      setSyncMsg("请先登录");
      return;
    }
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const list = await db.snippets.filter((s) => needsUpload(s.syncStatus)).toArray();
      let ok = 0;
      for (const s of list) {
        try {
          const { cloudId } = await uploadSnippet(db, token, s, { apiBase });
          await db.snippets.update(s.id, { syncStatus: "synced", cloudId });
          ok++;
        } catch {
          await db.snippets.update(s.id, { syncStatus: "failed" });
        }
      }
      setSyncMsg(`推送完成：成功 ${ok} / ${list.length}`);
    } finally {
      setSyncBusy(false);
    }
  }, [token]);

  const add = useCallback(async () => {
    const saveDomain = currentTabDomain.trim().toLowerCase();
    if (!saveDomain) {
      window.alert("当前标签页无法解析域名（例如空白页或浏览器内部页），请打开普通网页后再保存。");
      return;
    }
    if (!content.trim()) {
      window.alert("请输入内容");
      return;
    }
    const now = Date.now();
    const row: SnippetRecord = {
      id: createId("snp"),
      type,
      content: content.trim(),
      sourceDomain: saveDomain,
      sourceUrl: tabUrl || undefined,
      sourceTitle: tabTitle || undefined,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local_only",
    };
    await db.snippets.add(row);
    setContent("");
  }, [content, currentTabDomain, tabUrl, tabTitle, type]);

  const remove = useCallback(async (id: string) => {
    await db.snippets.delete(id);
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const startEdit = useCallback((s: SnippetRecord) => {
    setEditingId(s.id);
    setEditType(s.type);
    setEditContent(s.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    if (!editContent.trim()) {
      window.alert("内容不能为空");
      return;
    }
    const prev = await db.snippets.get(editingId);
    if (!prev) {
      cancelEdit();
      return;
    }
    const now = Date.now();
    const nextStatus: SyncStatus = nextSyncAfterEdit(prev.syncStatus);
    await db.snippets.update(editingId, {
      type: editType,
      content: editContent.trim(),
      updatedAt: now,
      syncStatus: nextStatus,
    });
    cancelEdit();
  }, [cancelEdit, editContent, editType, editingId]);

  const canSaveNew = Boolean(currentTabDomain.trim()) && content.trim().length > 0;

  return (
    <div
      style={{
        width: 400,
        maxHeight: 560,
        overflow: "auto",
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: 13,
        padding: 12,
        color: "#1f2430",
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 15 }}>站点短文本</h1>
      <p style={{ margin: "0 0 8px", color: "#6b7280", lineHeight: 1.4 }}>
        数据保存在本扩展的 IndexedDB（与 Web 同库结构）；登录同一账号后手动拉取/推送即可与 Web 云端对齐。
      </p>

      <div
        style={{
          marginBottom: 10,
          padding: 8,
          background: "#f9fafb",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
        }}
      >
        {token && user ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#374151" }}>
              已登录：<strong>{user.email}</strong>
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer" }}
            >
              退出
            </button>
            <button
              type="button"
              disabled={syncBusy}
              onClick={() => void handlePull()}
              style={{ padding: "4px 8px", fontSize: 11, background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: syncBusy ? "not-allowed" : "pointer" }}
            >
              从云端拉取
            </button>
            <button
              type="button"
              disabled={syncBusy}
              onClick={() => void handlePush()}
              style={{ padding: "4px 8px", fontSize: 11, background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: syncBusy ? "not-allowed" : "pointer" }}
            >
              推送到云端
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              style={{ padding: "6px 8px", fontSize: 12 }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              style={{ padding: "6px 8px", fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => void handleLogin()}
              style={{ padding: "6px 10px", fontSize: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              登录（与 Web 同一账号）
            </button>
            {authError ? <div style={{ fontSize: 11, color: "#b91c1c" }}>{authError}</div> : null}
          </div>
        )}
        {syncMsg ? <div style={{ marginTop: 6, fontSize: 11, color: "#4b5563" }}>{syncMsg}</div> : null}
      </div>

      <div style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          当前页域名：<strong style={{ color: "#374151" }}>{currentTabDomain || "—"}</strong>
        </span>
        <button
          type="button"
          onClick={() => refreshActiveTab()}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #d1d5db",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          刷新页面信息
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ color: "#6b7280" }}>按域名筛选（留空表示全部）</span>
        <input
          list="snippet-domain-options"
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          placeholder="例如 github.com"
          style={{ width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
        />
        <datalist id="snippet-domain-options">
          {domainOptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </label>
      <button
        type="button"
        onClick={() => setFilterDomain(currentTabDomain)}
        disabled={!currentTabDomain}
        style={{
          marginBottom: 8,
          padding: "4px 8px",
          fontSize: 11,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          background: "#fff",
          cursor: currentTabDomain ? "pointer" : "not-allowed",
        }}
      >
        筛选设为当前标签页域名
      </button>

      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ color: "#6b7280" }}>搜索（类型、内容、标题、URL）</span>
        <input
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="关键词…"
          style={{ width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SnippetType)}
          style={{ flex: 1, minWidth: 120, padding: "6px 8px" }}
        >
          {(Object.keys(SNIPPET_TYPE_LABELS) as SnippetType[]).map((t) => (
            <option key={t} value={t}>
              {SNIPPET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="粘贴或输入短文本…"
        style={{
          width: "100%",
          minHeight: 72,
          padding: 8,
          boxSizing: "border-box",
          marginBottom: 8,
        }}
      />
      <button
        type="button"
        disabled={!canSaveNew}
        onClick={() => void add()}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontWeight: 600,
          background: canSaveNew ? "#2563eb" : "#9ca3af",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: canSaveNew ? "pointer" : "not-allowed",
        }}
      >
        保存到当前页域名
      </button>

      <h2 style={{ margin: "16px 0 8px", fontSize: 13 }}>条目列表</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {listRows.map((s) => {
          const editing = editingId === s.id;
          return (
            <li
              key={s.id}
              style={{
                borderTop: "1px solid #e5e7eb",
                padding: "8px 0",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {SNIPPET_TYPE_LABELS[s.type]} · {s.sourceDomain} · 采集 {formatCaptureTime(s.createdAt)}
                  {s.updatedAt !== s.createdAt ? ` · 更新 ${formatCaptureTime(s.updatedAt)}` : null}
                </div>
                {s.sourceTitle ? (
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }} title={s.sourceTitle}>
                    {s.sourceTitle.length > 48 ? `${s.sourceTitle.slice(0, 48)}…` : s.sourceTitle}
                  </div>
                ) : null}
                {editing ? (
                  <div style={{ marginTop: 6 }}>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as SnippetType)}
                      style={{ width: "100%", marginBottom: 6, padding: "6px 8px" }}
                    >
                      {(Object.keys(SNIPPET_TYPE_LABELS) as SnippetType[]).map((t) => (
                        <option key={t} value={t}>
                          {SNIPPET_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: 64,
                        padding: 8,
                        boxSizing: "border-box",
                        marginBottom: 6,
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        style={{
                          padding: "4px 10px",
                          fontSize: 12,
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          padding: "4px 10px",
                          fontSize: 12,
                          border: "1px solid #d1d5db",
                          borderRadius: 4,
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4 }}>{s.content}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                      {SYNC_STATUS_LABELS[s.syncStatus]}
                    </div>
                  </>
                )}
              </div>
              {!editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s.id)}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#9f1239",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    删除
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {listRows.length === 0 ? (
        <p style={{ color: "#9ca3af", marginTop: 8 }}>
          {items.length === 0 ? "暂无条目" : "无匹配条目，可调整筛选或搜索"}
        </p>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
