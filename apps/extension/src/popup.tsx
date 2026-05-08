import type { SyncStatus } from "@my-notes/shared";
import {
  SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
  SYNC_STATUS_LABELS,
  createId,
  formatSiteItemDisplayName,
  nextSyncAfterEdit,
  parseProjectCredentialMirrorItemName,
} from "@my-notes/shared";
import { db } from "@my-notes/local-db";
import {
  deleteSiteItemOnCloud,
  syncAllSitesWithConflict,
  syncDirtySitesToCloud,
} from "@my-notes/sync-client";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReloadOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Card, Divider, Input, List, Space, Tag, Tooltip, Typography, Dropdown } from "antd";
import type { MenuProps } from "antd/es/menu";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { clearSession, readSession, writeSession, type AuthUser } from "./auth-session";
import { migrateLegacySnippetsIfNeeded } from "./migrate-legacy";
import { migrateSnippetsToSitesIfNeeded } from "./migrate-snippets-to-sites";
import "antd/dist/reset.css";

const apiBase = import.meta.env.VITE_API_BASE;

const SIDE_PANEL_SHELL_BASE: CSSProperties = {
  boxSizing: "border-box",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "linear-gradient(180deg, #f7f9ff 0%, #eef3ff 100%)",
  height: "100vh",
};

const SIDE_PANEL_CARD: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const SIDE_PANEL_CARD_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const SIDE_PANEL_MAIN_COLUMN: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const SIDE_PANEL_LIST_SCROLL: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  paddingRight: 2,
};

const SIDE_PANEL_FOOTER: CSSProperties = {
  flexShrink: 0,
};

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
  syncStatus: SyncStatus;
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
  const [itemSearch, setItemSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("demo");
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemContent, setEditItemContent] = useState("");
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>([]);

  const siteRows = useLiveQuery(() => db.sites.toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];

  const sites = useMemo<SiteVM[]>(
    () =>
      siteRows.map((site) => ({
        id: site.id,
        name: site.name,
        address: site.address,
        syncStatus: site.syncStatus,
        items: itemRows
          .filter(
            (item) => item.siteId === site.id && item.name !== SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
          )
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

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? null,
    [selectedSiteId, sites],
  );

  useEffect(() => {
    if (sites.length === 0) {
      setSelectedSiteId(null);
      return;
    }
    if (currentTabDomain) {
      const currentSite = sites.find((site) => site.address.toLowerCase() === currentTabDomain);
      if (currentSite) {
        if (selectedSiteId !== currentSite.id) setSelectedSiteId(currentSite.id);
        return;
      }
    }
    if (!selectedSiteId || !sites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(sites[0].id);
    }
  }, [currentTabDomain, selectedSiteId, sites]);

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
    setAuthOpen(false);
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

  const ensureSiteForCurrentDomain = useCallback(async (): Promise<string> => {
    const domain = currentTabDomain.trim().toLowerCase() || "unknown.local";
    const matched = sites.find((site) => site.address.toLowerCase() === domain);
    if (matched) return matched.id;
    const siteId = createId("site");
    await db.sites.add({
      id: siteId,
      name: domain,
      address: domain,
      updatedAt: Date.now(),
      version: 1,
      syncStatus: "local_only",
    });
    return siteId;
  }, [currentTabDomain, sites]);

  const handleAddItem = useCallback(async () => {
    if (!newItemContent.trim()) {
      window.alert("内容为必填项");
      return;
    }
    const siteId = selectedSiteId ?? (await ensureSiteForCurrentDomain());
    if (!selectedSiteId) setSelectedSiteId(siteId);
    const siteRow = await db.sites.get(siteId);
    await db.site_items.add({
      id: createId("item"),
      siteId,
      projectId: siteRow?.projectId,
      name: newItemName.trim(),
      content: newItemContent,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    setNewItemName("");
    setNewItemContent("");
  }, [ensureSiteForCurrentDomain, newItemContent, newItemName, selectedSiteId]);

  const startEditItem = useCallback((itemId: string, name: string, content: string) => {
    if (parseProjectCredentialMirrorItemName(name)) return;
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
    if (parseProjectCredentialMirrorItemName(prev.name)) {
      cancelEditItem();
      return;
    }
    await db.site_items.update(editingItemId, {
      name: editItemName.trim(),
      content: editItemContent,
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
      if (parseProjectCredentialMirrorItemName(row.name)) return;
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

  const handleCopyItem = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setSyncMsg("复制成功");
    } catch {
      setSyncMsg("复制失败，请检查浏览器权限");
    }
  }, []);

  const handleTogglePin = useCallback((itemId: string) => {
    setPinnedItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  }, []);

  const displayItems = useMemo(() => {
    if (!selectedSite) return [];
    const kw = itemSearch.trim().toLowerCase();
    let list = selectedSite.items;
    if (kw) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(kw) ||
          it.content.toLowerCase().includes(kw) ||
          formatSiteItemDisplayName(it.name).toLowerCase().includes(kw),
      );
    }
    return [...list].sort((a, b) => {
      const pinnedA = pinnedItemIds.includes(a.id) ? 1 : 0;
      const pinnedB = pinnedItemIds.includes(b.id) ? 1 : 0;
      if (pinnedA !== pinnedB) return pinnedB - pinnedA;
      return b.updatedAt - a.updatedAt;
    });
  }, [itemSearch, pinnedItemIds, selectedSite]);

  const canSaveNewItem = Boolean(newItemContent.trim());

  const items: MenuProps['items'] = [
    {
      key: '1',
      label: '复制',
      icon: <CopyOutlined />,
    },
    {
      key: '2',
      label: '置顶',
      icon: <PushpinFilled />,
      extra: '⌘P',
    },
    {
      key: '3',
      label: '编辑',
      icon: <EditOutlined />,
      extra: '⌘B',
    },
    {
      type: 'divider',
    },
    {
      key: '4',
      label: '删除',
      icon: <DeleteOutlined />,
      extra: '⌘S',
    },
  ];

  return (
    <AntApp>
      <div style={SIDE_PANEL_SHELL_BASE}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text ellipsis style={{ maxWidth: 190 }}>
            {currentTabDomain || selectedSite?.address || "unknown.local"}
          </Typography.Text>
          <Space size={4}>
            {!token ? (
              <Tooltip title="登录">
                <Button
                  icon={<LoginOutlined />}
                  size="small"
                  onClick={() => setAuthOpen((prev) => !prev)}
                />
              </Tooltip>
            ) : (
              <>
                <Tooltip title="退出">
                  <Button
                    icon={<LogoutOutlined />}
                    size="small"
                    disabled={syncBusy}
                    onClick={() => void handleLogout()}
                  />
                </Tooltip>
                <Tooltip title="拉取">
                  <Button
                    icon={<VerticalAlignBottomOutlined />}
                    size="small"
                    disabled={syncBusy}
                    onClick={() => void handlePullFromCloud()}
                  />
                </Tooltip>
                <Tooltip title="推送">
                  <Button
                    icon={<VerticalAlignTopOutlined />}
                    size="small"
                    disabled={syncBusy}
                    onClick={() => void handlePushToCloud()}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        </Space>
        {authOpen && !token ? (
          <Space direction="vertical" style={{ width: "100%", marginBottom: 10 }} size={8}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
            <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
            <Space>
              <Button type="primary" onClick={() => void handleLogin()}>
                登录
              </Button>
              <Button onClick={() => void handleRegister()}>注册</Button>
            </Space>
            {authError ? <Typography.Text type="danger">{authError}</Typography.Text> : null}
          </Space>
        ) : null}

        <div style={SIDE_PANEL_MAIN_COLUMN}>
          <Input
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="过滤当前条目"
            prefix={<ReloadOutlined />}
          />
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Typography.Text strong>条目列表</Typography.Text>
            {/* <Tooltip title="新增条目"> */}
            <Button icon={<PlusOutlined />} size="small" onClick={() => setCreateOpen((prev) => !prev)} />
            {/* </Tooltip> */}
          </Space>

          {createOpen ? (
            <Card size="small">
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="条目名称" />
                <Input.TextArea
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  placeholder="条目内容（支持多行）"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
                <Space>
                  <Button type="primary" disabled={!canSaveNewItem} onClick={() => void handleAddItem()}>
                    保存
                  </Button>
                  <Button onClick={() => setCreateOpen(false)}>取消</Button>
                </Space>
              </Space>
            </Card>
          ) : null}

          <div style={SIDE_PANEL_LIST_SCROLL}>
            <List
              size="small"
              dataSource={displayItems}
              locale={{ emptyText: "暂无条目" }}
              renderItem={(it) => {
                const editing = editingItemId === it.id;
                const pinned = pinnedItemIds.includes(it.id);
                const isMirror = parseProjectCredentialMirrorItemName(it.name) !== null;
                const itemLabel = formatSiteItemDisplayName(it.name);
                return (
                  <List.Item key={it.id}>
                    <Space direction="vertical" style={{ width: "100%" }} size={6}>
                      {editing ? (
                        <>
                          <Input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} placeholder="条目名称" />
                          <Input.TextArea
                            value={editItemContent}
                            onChange={(e) => setEditItemContent(e.target.value)}
                            autoSize={{ minRows: 3, maxRows: 6 }}
                          />
                          <Space>
                            <Button type="primary" size="small" onClick={() => void saveEditItem()}>
                              保存
                            </Button>
                            <Button size="small" onClick={cancelEditItem}>
                              取消
                            </Button>
                          </Space>
                        </>
                      ) : (
                        <>
                          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                            {it.content}
                          </Typography.Paragraph>
                          <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                            <Space size={4} wrap>
                              <Typography.Text type="secondary">{itemLabel}</Typography.Text>
                              <Tag>{SYNC_STATUS_LABELS[it.syncStatus]}</Tag>
                              <Typography.Text type="secondary">{formatTime(it.updatedAt)}</Typography.Text>
                            </Space>
                            <Dropdown menu={{ items }}>
                              <a onClick={(e) => e.preventDefault()}>
                                <Space>
                                  <MoreOutlined />
                                </Space>
                              </a>
                            </Dropdown>
                            <Space size={2}>
                              <Tooltip title="复制">
                                <Button icon={<CopyOutlined />} size="small" disabled={syncBusy} onClick={() => void handleCopyItem(it.content)} />
                              </Tooltip>
                              <Tooltip title={pinned ? "取消置顶" : "置顶"}>
                                <Button
                                  icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
                                  size="small"
                                  disabled={syncBusy}
                                  onClick={() => handleTogglePin(it.id)}
                                />
                              </Tooltip>
                              <Tooltip title="编辑">
                                <Button
                                  icon={<EditOutlined />}
                                  size="small"
                                  disabled={syncBusy || isMirror}
                                  onClick={() => startEditItem(it.id, it.name, it.content)}
                                />
                              </Tooltip>
                              <Tooltip title="删除">
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  size="small"
                                  disabled={syncBusy || isMirror}
                                  onClick={() => void handleDeleteItem(it.id)}
                                />
                              </Tooltip>
                            </Space>
                          </Space>
                        </>
                      )}
                    </Space>
                  </List.Item>
                );
              }}
            />
          </div>
        </div>

        <div style={SIDE_PANEL_FOOTER}>
          <Divider style={{ margin: "10px 0" }} />
          <Space size={8}>
            <Tag>{selectedSite ? `站点状态: ${SYNC_STATUS_LABELS[selectedSite.syncStatus]}` : "站点状态: 未创建"}</Tag>
            <Tooltip title="刷新地址">
              <Button icon={<ReloadOutlined />} size="small" onClick={() => refreshActiveTab()} />
            </Tooltip>
          </Space>
          {syncMsg ? (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              {syncMsg}
            </Typography.Text>
          ) : null}
        </div>
      </div>
    </AntApp>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
