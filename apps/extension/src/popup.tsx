import type { SyncStatus } from "@my-notes/shared";
import { SYNC_STATUS_LABELS, createId, nextSyncAfterEdit } from "@my-notes/shared";
import { db } from "@my-notes/local-db";
import {
  deleteSiteItemOnCloud,
  deleteSiteOnCloud,
  syncAllSitesWithConflict,
  syncDirtySitesToCloud,
} from "@my-notes/sync-client";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { clearSession, readSession, writeSession, type AuthUser } from "./auth-session";
import { migrateLegacySnippetsIfNeeded } from "./migrate-legacy";
import { migrateSnippetsToSitesIfNeeded } from "./migrate-snippets-to-sites";

const apiBase = import.meta.env.VITE_API_BASE;

function domainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

type SiteVM = {
  id: string;
  name: string;
  address: string;
  version: number;
  syncStatus: SyncStatus;
  cloudId?: string;
  items: {
    id: string;
    name: string;
    content: string;
    syncStatus: SyncStatus;
    cloudId?: string;
    updatedAt: number;
  }[];
};

function Popup() {
  const [currentTabDomain, setCurrentTabDomain] = useState<string>("");
  const [siteSearch, setSiteSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("demo");
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemContent, setEditItemContent] = useState("");

  const siteRows = useLiveQuery(() => db.sites.toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];

  const sites = useMemo<SiteVM[]>(
    () =>
      siteRows.map((site) => ({
        id: site.id,
        name: site.name,
        address: site.address,
        version: site.version ?? 1,
        syncStatus: site.syncStatus,
        cloudId: site.cloudId,
        items: itemRows
          .filter((item) => item.siteId === site.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            content: item.content,
            syncStatus: item.syncStatus,
            cloudId: item.cloudId,
            updatedAt: item.updatedAt,
          })),
      })),
    [itemRows, siteRows],
  );

  const filteredSites = useMemo(() => {
    const keyword = siteSearch.trim().toLowerCase();
    if (!keyword) return sites;
    return sites.filter((site) => site.name.toLowerCase().includes(keyword));
  }, [siteSearch, sites]);

  /** 下拉中始终包含当前选中站点，避免搜索过滤后选项消失。 */
  const siteSelectOptions = useMemo(() => {
    const sel = sites.find((s) => s.id === selectedSiteId);
    if (!sel) return filteredSites;
    if (filteredSites.some((s) => s.id === sel.id)) return filteredSites;
    return [sel, ...filteredSites];
  }, [filteredSites, selectedSiteId, sites]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? null,
    [selectedSiteId, sites],
  );

  useEffect(() => {
    if (siteRows.length === 0) {
      if (selectedSiteId !== null) setSelectedSiteId(null);
      return;
    }
    if (!selectedSiteId || !siteRows.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(siteRows[0].id);
    }
  }, [selectedSiteId, siteRows]);

  const refreshActiveTab = useCallback(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      setCurrentTabDomain(domainFromUrl(t?.url));
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await migrateLegacySnippetsIfNeeded();
      await migrateSnippetsToSitesIfNeeded();
      const s = await readSession();
      setToken(s.token);
      setUser(s.user);
    })();
    void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      setCurrentTabDomain(domainFromUrl(t?.url));
    });
  }, []);

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

  const handleRegister = useCallback(async () => {
    setAuthError(null);
    try {
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "注册失败");
      }
      const data = (await res.json()) as { token: string; user: AuthUser };
      await writeSession(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
      setSyncMsg("注册成功，已自动登录");
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

  /** 与 Web 站点列表「云下载」一致：拉取并合并冲突。 */
  const handlePullFromCloud = useCallback(async () => {
    if (!token) {
      setSyncMsg("请先登录后再同步");
      return;
    }
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res = await syncAllSitesWithConflict(db, token, { apiBase });
      setSyncMsg(`拉取完成：站点 ${res.pulledSites}、条目 ${res.pulledItems}`);
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }, [token]);

  /** 与 Web 站点列表「云上传」一致：推送全部未同步站点与条目。 */
  const handlePushToCloud = useCallback(async () => {
    if (!token) {
      setSyncMsg("请先登录后再同步");
      return;
    }
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      await syncDirtySitesToCloud(db, token, { apiBase });
      setSyncMsg("已同步全部本地站点数据到云端");
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }, [token]);

  const openCreateSite = useCallback(() => {
    const d = currentTabDomain.trim();
    setNewSiteName(d || "");
    setNewSiteAddress(d || "");
    setCreateOpen(true);
  }, [currentTabDomain]);

  const handleCreateSite = useCallback(async () => {
    if (!newSiteName.trim() || !newSiteAddress.trim()) {
      window.alert("站点名称和站点地址不能为空（与 Web 站点页一致）");
      return;
    }
    const siteId = createId("site");
    await db.sites.add({
      id: siteId,
      name: newSiteName.trim(),
      address: newSiteAddress.trim(),
      updatedAt: Date.now(),
      version: 1,
      syncStatus: "local_only",
    });
    setSelectedSiteId(siteId);
    setCreateOpen(false);
    setNewSiteName("");
    setNewSiteAddress("");
  }, [newSiteAddress, newSiteName]);

  const handleDeleteSite = useCallback(
    async (siteId: string) => {
      if (!window.confirm("确认删除站点？站点和其条目将被删除（与 Web 一致）")) return;
      try {
        if (token) {
          await deleteSiteOnCloud(token, siteId, { apiBase });
        }
      } catch (e) {
        setSyncMsg((e as Error).message);
        return;
      }
      await db.transaction("rw", db.sites, db.site_items, async () => {
        await db.site_items.where("siteId").equals(siteId).delete();
        await db.sites.delete(siteId);
      });
      if (selectedSiteId === siteId) setSelectedSiteId(null);
    },
    [apiBase, selectedSiteId, token],
  );

  const handleAddItem = useCallback(async () => {
    if (!selectedSiteId) {
      window.alert("请先选择或新建站点");
      return;
    }
    if (!newItemContent.trim()) {
      window.alert("内容为必填项");
      return;
    }
    await db.site_items.add({
      id: createId("item"),
      siteId: selectedSiteId,
      name: newItemName.trim(),
      content: newItemContent.trim(),
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    setNewItemName("");
    setNewItemContent("");
  }, [newItemContent, newItemName, selectedSiteId]);

  const startEditItem = useCallback((itemId: string, name: string, content: string) => {
    setEditingItemId(itemId);
    setEditItemName(name);
    setEditItemContent(content);
  }, []);

  const cancelEditItem = useCallback(() => {
    setEditingItemId(null);
    setEditItemName("");
    setEditItemContent("");
  }, []);

  const saveEditItem = useCallback(async () => {
    if (!editingItemId || !selectedSiteId) return;
    if (!editItemContent.trim()) {
      window.alert("内容为必填项");
      return;
    }
    const prev = await db.site_items.get(editingItemId);
    if (!prev || prev.siteId !== selectedSiteId) {
      cancelEditItem();
      return;
    }
    await db.site_items.update(editingItemId, {
      name: editItemName.trim(),
      content: editItemContent.trim(),
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(prev.syncStatus),
    });
    cancelEditItem();
  }, [cancelEditItem, editItemContent, editItemName, editingItemId, selectedSiteId]);

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!selectedSiteId) return;
      if (!window.confirm("确认删除该条目？")) return;
      const row = await db.site_items.get(itemId);
      if (!row || row.siteId !== selectedSiteId) return;
      try {
        if (token) {
          await deleteSiteItemOnCloud(token, itemId, { apiBase });
        } else if (row.syncStatus !== "local_only") {
          const site = await db.sites.get(selectedSiteId);
          if (site) {
            await db.sites.update(selectedSiteId, {
              updatedAt: Date.now(),
              syncStatus: nextSyncAfterEdit(site.syncStatus),
              version: site.version ?? 1,
            });
          }
        }
      } catch (e) {
        setSyncMsg((e as Error).message);
        return;
      }
      await db.site_items.delete(itemId);
      if (editingItemId === itemId) cancelEditItem();
    },
    [apiBase, cancelEditItem, editingItemId, selectedSiteId, token],
  );

  const displayItems = useMemo(() => {
    if (!selectedSite) return [];
    const kw = itemSearch.trim().toLowerCase();
    let list = selectedSite.items;
    if (kw) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(kw) ||
          it.content.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [itemSearch, selectedSite]);

  const canSaveNewItem = Boolean(selectedSiteId && newItemContent.trim());

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
      <h1 style={{ margin: "0 0 8px", fontSize: 15 }}>站点</h1>
      <p style={{ margin: "0 0 8px", color: "#6b7280", lineHeight: 1.4 }}>
        与 Web「站点」页使用同一套云端接口（站点 / 站点条目）；登录同一账号后使用下方「从云端拉取」「推送到云端」与 Web 列表栏云同步行为一致，保证已上云数据对齐。
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
              onClick={() => void handlePullFromCloud()}
              style={{ padding: "4px 8px", fontSize: 11, background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: syncBusy ? "not-allowed" : "pointer" }}
            >
              从云端拉取
            </button>
            <button
              type="button"
              disabled={syncBusy}
              onClick={() => void handlePushToCloud()}
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void handleLogin()}
                style={{ padding: "6px 10px", fontSize: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
              >
                登录（与 Web 同一账号）
              </button>
              <button
                type="button"
                onClick={() => void handleRegister()}
                style={{ padding: "6px 10px", fontSize: 12, background: "#fff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 4, cursor: "pointer" }}
              >
                注册（密码至少 8 位）
              </button>
            </div>
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

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", color: "#6b7280", fontSize: 12 }}>站点（必选）</label>
        <select
          value={selectedSiteId ?? ""}
          onChange={(e) => setSelectedSiteId(e.target.value || null)}
          style={{ width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
        >
          <option value="">—</option>
          {siteSelectOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.address}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setNewSiteName("");
            setNewSiteAddress("");
            setCreateOpen(true);
          }}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          新增站点
        </button>
        <button
          type="button"
          onClick={() => openCreateSite()}
          disabled={!currentTabDomain}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #d1d5db",
            borderRadius: 4,
            background: "#fff",
            cursor: currentTabDomain ? "pointer" : "not-allowed",
          }}
        >
          用当前域名填站点名称与地址
        </button>
        <button
          type="button"
          disabled={!selectedSiteId}
          onClick={() => selectedSiteId && void handleDeleteSite(selectedSiteId)}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#9f1239",
            borderRadius: 4,
            cursor: selectedSiteId ? "pointer" : "not-allowed",
          }}
        >
          删除当前站点
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ color: "#6b7280", fontSize: 12 }}>搜索站点名称</span>
        <input
          value={siteSearch}
          onChange={(e) => setSiteSearch(e.target.value)}
          placeholder="与 Web 站点列表搜索一致"
          style={{ width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
        />
      </label>

      {createOpen ? (
        <div
          style={{
            marginBottom: 10,
            padding: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>新增站点</div>
          <input
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            placeholder="站点名称（必填）"
            style={{ width: "100%", marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
          />
          <input
            value={newSiteAddress}
            onChange={(e) => setNewSiteAddress(e.target.value)}
            placeholder="站点地址（必填）"
            style={{ width: "100%", marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => void handleCreateSite()}
              disabled={!newSiteName.trim() || !newSiteAddress.trim()}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: newSiteName.trim() && newSiteAddress.trim() ? "pointer" : "not-allowed",
              }}
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              style={{ padding: "4px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer" }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {!selectedSite ? (
        <p style={{ color: "#9ca3af" }}>暂无站点，请先新增站点。</p>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
            当前站点地址：<strong>{selectedSite.address || "未设置站点地址"}</strong> · {SYNC_STATUS_LABELS[selectedSite.syncStatus]}
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ color: "#6b7280", fontSize: 12 }}>搜索条目（名称、内容）</span>
            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "6px 8px", boxSizing: "border-box" }}
            />
          </label>

          <div style={{ fontWeight: 600, margin: "12px 0 6px", fontSize: 13 }}>新增条目</div>
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="名称（非必填）"
            style={{ width: "100%", marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
          />
          <textarea
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="内容（必填）"
            style={{ width: "100%", minHeight: 64, padding: 8, boxSizing: "border-box", marginBottom: 6 }}
          />
          <button
            type="button"
            disabled={!canSaveNewItem}
            onClick={() => void handleAddItem()}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontWeight: 600,
              background: canSaveNewItem ? "#2563eb" : "#9ca3af",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: canSaveNewItem ? "pointer" : "not-allowed",
              marginBottom: 12,
            }}
          >
            新增条目
          </button>

          <h2 style={{ margin: "0 0 8px", fontSize: 13 }}>条目列表</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {displayItems.map((it) => {
              const editing = editingItemId === it.id;
              return (
                <li
                  key={it.id}
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
                      {it.name || "（未命名）"} · 更新 {formatTime(it.updatedAt)}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{SYNC_STATUS_LABELS[it.syncStatus]}</div>
                    {editing ? (
                      <div style={{ marginTop: 6 }}>
                        <input
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          placeholder="名称（非必填）"
                          style={{ width: "100%", marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
                        />
                        <textarea
                          value={editItemContent}
                          onChange={(e) => setEditItemContent(e.target.value)}
                          placeholder="内容（必填）"
                          style={{ width: "100%", minHeight: 64, padding: 8, boxSizing: "border-box", marginBottom: 6 }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => void saveEditItem()}
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
                            onClick={cancelEditItem}
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
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4 }}>{it.content || "-"}</div>
                    )}
                  </div>
                  {!editing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => startEditItem(it.id, it.name, it.content)}
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
                        onClick={() => void handleDeleteItem(it.id)}
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
          {displayItems.length === 0 ? (
            <p style={{ color: "#9ca3af", marginTop: 8 }}>
              {selectedSite.items.length === 0 ? "暂无条目，请在上方新增条目" : "无匹配条目，可调整搜索"}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
