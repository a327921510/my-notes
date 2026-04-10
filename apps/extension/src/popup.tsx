import type { SnippetRecord, SnippetType } from "@my-notes/shared";
import { SNIPPET_TYPE_LABELS } from "@my-notes/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createId } from "./id";
import { loadSnippets, saveSnippets } from "./storage";

function domainFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function Popup() {
  const [tabUrl, setTabUrl] = useState<string>("");
  const [tabTitle, setTabTitle] = useState<string>("");
  const [items, setItems] = useState<SnippetRecord[]>([]);
  const [type, setType] = useState<SnippetType>("account");
  const [content, setContent] = useState("");
  const [filterDomain, setFilterDomain] = useState<string>("");

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      setTabUrl(t?.url ?? "");
      setTabTitle(t?.title ?? "");
      setFilterDomain(domainFromUrl(t?.url));
    });
    void (async () => {
      setItems(await loadSnippets());
    })();
  }, []);

  const domain = filterDomain.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!domain) return items;
    return items.filter((s) => s.sourceDomain === domain);
  }, [items, domain]);

  const persist = useCallback(async (next: SnippetRecord[]) => {
    setItems(next);
    await saveSnippets(next);
  }, []);

  const add = useCallback(async () => {
    if (!domain) {
      window.alert("无法解析当前页域名");
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
      sourceDomain: domain,
      sourceUrl: tabUrl || undefined,
      sourceTitle: tabTitle || undefined,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local_only",
    };
    await persist([row, ...items]);
    setContent("");
  }, [content, domain, items, persist, tabUrl, tabTitle, type]);

  const remove = useCallback(
    async (id: string) => {
      await persist(items.filter((s) => s.id !== id));
    },
    [items, persist],
  );

  return (
    <div
      style={{
        width: 380,
        maxHeight: 520,
        overflow: "auto",
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: 13,
        padding: 12,
        color: "#1f2430",
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 15 }}>站点短文本</h1>
      <p style={{ margin: "0 0 8px", color: "#6b7280", lineHeight: 1.4 }}>
        数据保存在扩展 storage，与 Web 端 IndexedDB 不共享；在 Web「站点信息区」管理同结构数据或后续通过服务端同步对齐。
      </p>
      <label style={{ display: "block", marginBottom: 6 }}>
        <span style={{ color: "#6b7280" }}>域名</span>
        <input
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
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
        onClick={() => void add()}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontWeight: 600,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        保存到当前域名
      </button>
      <h2 style={{ margin: "16px 0 8px", fontSize: 13 }}>本域名条目</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((s) => (
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
                {SNIPPET_TYPE_LABELS[s.type]} · {s.sourceDomain}
              </div>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{s.content}</div>
            </div>
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
              }}
            >
              删
            </button>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? (
        <p style={{ color: "#9ca3af", marginTop: 8 }}>暂无</p>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
