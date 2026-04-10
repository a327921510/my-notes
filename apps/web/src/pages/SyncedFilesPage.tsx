import { DeleteOutlined } from "@ant-design/icons";
import { App, Button, Card, Checkbox, Modal, Space, Table, Typography } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { deleteCloudNote, deleteCloudSnippet } from "@/lib/cloud-api";
import { db } from "@/db/database";

type Row =
  | { key: string; kind: "note"; title: string; id: string; cloudId?: string; updatedAt: number }
  | {
      key: string;
      kind: "snippet";
      title: string;
      id: string;
      cloudId?: string;
      updatedAt: number;
      sourceDomain: string;
    };

export function SyncedFilesPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [deleteCloud, setDeleteCloud] = useState(true);
  const [pending, setPending] = useState<Row | null>(null);

  const notes = useLiveQuery(
    () =>
      db.notes
        .filter((n) => !n.deletedAt && n.syncStatus === "synced" && !!n.cloudId)
        .toArray(),
    [],
  );
  const snippets = useLiveQuery(
    () => db.snippets.filter((s) => s.syncStatus === "synced" && !!s.cloudId).toArray(),
    [],
  );

  const dataSource: Row[] = [
    ...(notes ?? []).map((n) => ({
      key: `n-${n.id}`,
      kind: "note" as const,
      title: n.title || "（无标题）",
      id: n.id,
      cloudId: n.cloudId,
      updatedAt: n.updatedAt,
    })),
    ...(snippets ?? []).map((s) => ({
      key: `s-${s.id}`,
      kind: "snippet" as const,
      title: s.content.slice(0, 48) + (s.content.length > 48 ? "…" : ""),
      id: s.id,
      cloudId: s.cloudId,
      updatedAt: s.updatedAt,
      sourceDomain: s.sourceDomain,
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  const runDelete = useCallback(async () => {
    if (!pending) return;
    const alsoCloud = deleteCloud && token;
    try {
      if (alsoCloud) {
        if (pending.kind === "note") {
          await deleteCloudNote(token, pending.id);
        } else {
          await deleteCloudSnippet(token, pending.id);
        }
      }
      if (pending.kind === "note") {
        await db.notes.update(pending.id, { deletedAt: Date.now() });
      } else {
        await db.snippets.delete(pending.id);
      }
      message.success(alsoCloud ? "已从本地移除并删除云端副本" : "已从本地移除（云端仍保留）");
    } catch (e) {
      message.error((e as Error).message);
      return;
    } finally {
      setPending(null);
      setDeleteCloud(true);
    }
  }, [pending, deleteCloud, token, message]);

  return (
    <div className="mx-auto max-w-4xl">
      <Card size="small" title="已同步内容管理">
        <Typography.Paragraph type="secondary" className="text-sm">
          列出已标记为「已同步」且存在云端 id 的笔记与短文本。删除时可选择是否同时删除云端副本（需已登录）。
        </Typography.Paragraph>
        <Table<Row>
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={dataSource}
          locale={{ emptyText: "暂无已同步条目" }}
          columns={[
            {
              title: "类型",
              width: 88,
              render: (_, r) => (r.kind === "note" ? "笔记" : "短文本"),
            },
            {
              title: "摘要 / 域名",
              render: (_, r) =>
                r.kind === "note" ? (
                  r.title
                ) : (
                  <span>
                    <Typography.Text type="secondary" className="text-xs">
                      {r.sourceDomain}
                    </Typography.Text>
                    <br />
                    {r.title}
                  </span>
                ),
            },
            {
              title: "cloudId",
              ellipsis: true,
              render: (_, r) => (
                <Typography.Text copyable className="text-xs">
                  {r.cloudId ?? "—"}
                </Typography.Text>
              ),
            },
            {
              title: "更新时间",
              width: 168,
              render: (_, r) => new Date(r.updatedAt).toLocaleString(),
            },
            {
              title: "操作",
              width: 100,
              render: (_, r) => (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setPending(r)}
                >
                  删除
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="确认删除"
        open={!!pending}
        onCancel={() => {
          setPending(null);
          setDeleteCloud(true);
        }}
        onOk={() => void runDelete()}
        okText="删除"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical">
          <Typography.Text>
            {pending?.kind === "note" ? `笔记：${pending.title}` : `短文本：${pending?.title}`}
          </Typography.Text>
          <Checkbox checked={deleteCloud} onChange={(e) => setDeleteCloud(e.target.checked)}>
            同时删除云端已同步副本
          </Checkbox>
          {!token && deleteCloud ? (
            <Typography.Text type="warning" className="text-sm">
              未登录时无法删除云端副本，将仅执行本地删除。
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
}
