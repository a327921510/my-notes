import { DeleteOutlined } from "@ant-design/icons";
import { App, Button, Card, Table, Typography } from "antd";
import { useCallback, useState } from "react";

import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { useSyncedData } from "./hooks/useSyncedData";
import type { SyncedRow } from "./types";

export function SyncedFilesPage() {
  const { message } = App.useApp();
  const { token, dataSource, deleteRow } = useSyncedData();
  const [deleteCloud, setDeleteCloud] = useState(true);
  const [pending, setPending] = useState<SyncedRow | null>(null);

  const runDelete = useCallback(async () => {
    if (!pending) return;
    try {
      const alsoCloud = await deleteRow(pending, deleteCloud);
      message.success(alsoCloud ? "已从本地移除并删除云端副本" : "已从本地移除（云端仍保留）");
    } catch (e) {
      message.error((e as Error).message);
      return;
    } finally {
      setPending(null);
      setDeleteCloud(true);
    }
  }, [pending, deleteCloud, deleteRow, message]);

  const handleCancel = useCallback(() => {
    setPending(null);
    setDeleteCloud(true);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <Card size="small" title="已同步内容管理">
        <Typography.Paragraph type="secondary" className="text-sm">
          列出已标记为「已同步」且存在云端 id 的笔记与短文本。删除时可选择是否同时删除云端副本（需已登录）。
        </Typography.Paragraph>
        <Table<SyncedRow>
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
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPending(r)}>
                  删除
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <DeleteConfirmModal
        pending={pending}
        deleteCloud={deleteCloud}
        hasToken={!!token}
        onDeleteCloudChange={setDeleteCloud}
        onConfirm={() => void runDelete()}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default SyncedFilesPage;
