import { CloudDownloadOutlined, CloudUploadOutlined, LoginOutlined, SwapOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Space, Tabs, Typography, Upload } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { db } from "@my-notes/local-db";
import { needsUpload } from "@my-notes/shared";
import { pullFromCloud, uploadNote, uploadSnippet } from "@my-notes/sync-client";
import { buildExportPayload, downloadExportJson, importArchiveMerge } from "@/lib/export-archive";

export function UploadPage() {
  const { message } = App.useApp();
  const { token, user, login } = useAuth();
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("demo");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const notes = useLiveQuery(() => db.notes.filter((n) => !n.deletedAt).toArray(), []);
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      const auth = await login(email, password);
      pushLog("登录成功，开始自动同步云端数据");
      const { notesApplied, snippetsApplied } = await pullFromCloud(db, auth.token);
      pushLog(`自动同步完成：笔记 ${notesApplied} 条，短文本 ${snippetsApplied} 条`);
      message.success(`登录成功并完成同步：笔记 ${notesApplied}，短文本 ${snippetsApplied}`);
    } catch (e) {
      const msg = (e as Error).message;
      pushLog(`登录失败: ${msg}`);
      message.error(msg);
    }
  }, [email, password, login, pushLog, message]);

  const uploadAllPending = useCallback(async () => {
    if (!token) {
      pushLog("请先登录");
      message.warning("请先登录");
      return;
    }
    setBusy(true);
    try {
      const noteList = (notes ?? []).filter((n) => needsUpload(n.syncStatus));
      for (const n of noteList) {
        try {
          const imgs = await db.images.where("noteId").equals(n.id).toArray();
          const { cloudId } = await uploadNote(db, token, n, imgs);
          await db.notes.update(n.id, { syncStatus: "synced", cloudId });
          pushLog(`笔记已上传: ${n.title || n.id} -> ${cloudId}`);
        } catch (e) {
          await db.notes.update(n.id, { syncStatus: "failed" });
          pushLog(`笔记失败: ${n.title || n.id} — ${(e as Error).message}`);
        }
      }

      const snipList = (snippets ?? []).filter((s) => needsUpload(s.syncStatus));
      for (const s of snipList) {
        try {
          const { cloudId } = await uploadSnippet(db, token, s);
          await db.snippets.update(s.id, { syncStatus: "synced", cloudId });
          pushLog(`短文本已上传: ${s.sourceDomain} / ${s.id} -> ${cloudId}`);
        } catch (e) {
          await db.snippets.update(s.id, { syncStatus: "failed" });
          pushLog(`短文本失败: ${s.id} — ${(e as Error).message}`);
        }
      }
      message.success("推送完成");
    } finally {
      setBusy(false);
    }
  }, [token, notes, snippets, pushLog, message]);

  const handlePull = useCallback(async () => {
    if (!token) {
      message.warning("请先登录");
      return;
    }
    setBusy(true);
    try {
      const { notesApplied, snippetsApplied } = await pullFromCloud(db, token);
      pushLog(`拉取完成：合并笔记 ${notesApplied} 条，短文本 ${snippetsApplied} 条`);
      message.success(`拉取完成：笔记 ${notesApplied}，短文本 ${snippetsApplied}`);
    } catch (e) {
      const msg = (e as Error).message;
      pushLog(`拉取失败: ${msg}`);
      message.error(msg);
    } finally {
      setBusy(false);
    }
  }, [token, pushLog, message]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const payload = await buildExportPayload();
      downloadExportJson(payload);
      pushLog(`已导出 ${payload.notes.length} 条笔记、${payload.blobs.length} 个 blob`);
      message.success("导出已开始下载");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pushLog, message]);

  const handleImportBeforeUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        await importArchiveMerge(file);
        pushLog(`已导入: ${file.name}`);
        message.success("导入完成（合并写入本地）");
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setBusy(false);
      }
      return false;
    },
    [pushLog, message],
  );

  const pendingNotes = (notes ?? []).filter((n) => needsUpload(n.syncStatus)).length;
  const pendingSnippets = (snippets ?? []).filter((s) => needsUpload(s.syncStatus)).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Tabs
        items={[
          {
            key: "account",
            label: (
              <span>
                <LoginOutlined /> 账号
              </span>
            ),
            children: (
              <Card size="small" title="账号">
                <Typography.Paragraph type="secondary" className="text-sm">
                  未登录仍可本地记录；上传与拉取需登录。演示账号任意邮箱 + 密码 <Typography.Text code>demo</Typography.Text>。
                </Typography.Paragraph>
                {user ? (
                  <Typography.Text>当前：{user.email}</Typography.Text>
                ) : (
                  <Space wrap className="mt-3 flex flex-col sm:flex-row">
                    <Input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input.Password
                      placeholder="密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button type="primary" onClick={() => void handleLogin()} disabled={busy}>
                      登录
                    </Button>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: "push",
            label: (
              <span>
                <CloudUploadOutlined /> 推送
              </span>
            ),
            children: (
              <Card size="small" title="上传队列（手动推送）">
                <Typography.Paragraph>
                  待上传笔记：{pendingNotes}；待上传短文本：{pendingSnippets}
                </Typography.Paragraph>
                <Button
                  type="primary"
                  disabled={busy || !token}
                  loading={busy}
                  icon={<CloudUploadOutlined />}
                  onClick={() => void uploadAllPending()}
                >
                  上传全部未同步
                </Button>
                {!token ? (
                  <Typography.Paragraph type="warning" className="mt-2 text-sm">
                    登录后可推送。
                  </Typography.Paragraph>
                ) : null}
              </Card>
            ),
          },
          {
            key: "pull",
            label: (
              <span>
                <CloudDownloadOutlined /> 拉取
              </span>
            ),
            children: (
              <Card size="small" title="从云端拉取">
                <Typography.Paragraph type="secondary" className="text-sm">
                  将云端已上传的笔记与短文本按时间戳合并到本地（较新覆盖较旧）。
                </Typography.Paragraph>
                <Button
                  type="primary"
                  disabled={busy || !token}
                  loading={busy}
                  icon={<CloudDownloadOutlined />}
                  onClick={() => void handlePull()}
                >
                  从云端拉取
                </Button>
                {!token ? (
                  <Typography.Paragraph type="warning" className="mt-2 text-sm">
                    登录后可拉取。
                  </Typography.Paragraph>
                ) : null}
              </Card>
            ),
          },
          {
            key: "offline",
            label: (
              <span>
                <SwapOutlined /> 导出 / 导入
              </span>
            ),
            children: (
              <Card size="small" title="离线全量导出与导入">
                <Space direction="vertical" className="w-full">
                  <Typography.Paragraph type="secondary" className="text-sm">
                    导出为 JSON（含图片 Base64），可在其他浏览器或设备导入并合并到本地。
                  </Typography.Paragraph>
                  <Button disabled={busy} loading={busy} onClick={() => void handleExport()}>
                    导出全部本地数据
                  </Button>
                  <Upload
                    accept="application/json,.json"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleImportBeforeUpload(file);
                      return false;
                    }}
                  >
                    <Button disabled={busy} loading={busy}>
                      选择文件导入（合并）
                    </Button>
                  </Upload>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      <Card size="small" className="mt-4" title="日志">
        <ul className="max-h-64 overflow-auto rounded border border-[#f0f0f0] bg-[#fafafa] p-2 font-mono text-xs">
          {log.length === 0 ? <li className="text-[#9ca3af]">暂无</li> : null}
          {log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
