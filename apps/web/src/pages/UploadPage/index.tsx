import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  LoginOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { App, Button, Card, Input, Space, Tabs, Typography, Upload } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";
import { db } from "@my-notes/local-db";
import { needsUpload } from "@my-notes/shared";

import { LogCard } from "./components/LogCard";
import { useUploadActions } from "./hooks/useUploadActions";

export function UploadPage() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("demo");

  const {
    token,
    busy,
    log,
    handleLogin,
    uploadAllPending,
    handlePull,
    handleExport,
    handleImport,
  } = useUploadActions();

  const notes = useLiveQuery(() => db.notes.filter((n) => !n.deletedAt).toArray(), []);
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);

  const onLogin = useCallback(async () => {
    try {
      const { notesApplied, snippetsApplied } = await handleLogin(email, password);
      message.success(`登录成功并完成同步：笔记 ${notesApplied}，短文本 ${snippetsApplied}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [email, password, handleLogin, message]);

  const onUploadAll = useCallback(async () => {
    try {
      await uploadAllPending(notes ?? [], snippets ?? []);
      message.success("推送完成");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [uploadAllPending, notes, snippets, message]);

  const onPull = useCallback(async () => {
    try {
      const { notesApplied, snippetsApplied } = await handlePull();
      message.success(`拉取完成：笔记 ${notesApplied}，短文本 ${snippetsApplied}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [handlePull, message]);

  const onExport = useCallback(async () => {
    try {
      await handleExport();
      message.success("导出已开始下载");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [handleExport, message]);

  const onImportBeforeUpload = useCallback(
    async (file: File) => {
      try {
        await handleImport(file);
        message.success("导入完成（合并写入本地）");
      } catch (e) {
        message.error((e as Error).message);
      }
      return false;
    },
    [handleImport, message],
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
                  未登录仍可本地记录；上传与拉取需登录。演示账号任意邮箱 + 密码{" "}
                  <Typography.Text code>demo</Typography.Text>。
                </Typography.Paragraph>
                {user ? (
                  <Typography.Text>当前：{user.email}</Typography.Text>
                ) : (
                  <Space wrap className="mt-3 flex flex-col sm:flex-row">
                    <Input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input.Password placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Button type="primary" onClick={() => void onLogin()} disabled={busy}>
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
                  onClick={() => void onUploadAll()}
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
                  onClick={() => void onPull()}
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
                  <Button disabled={busy} loading={busy} onClick={() => void onExport()}>
                    导出全部本地数据
                  </Button>
                  <Upload
                    accept="application/json,.json"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void onImportBeforeUpload(file);
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

      <LogCard log={log} />
    </div>
  );
}

export default UploadPage;
