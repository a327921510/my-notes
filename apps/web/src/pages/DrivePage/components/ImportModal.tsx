import {
  type ImportPreflightResult,
  type ImportResult,
  OnConflictStrategy,
  formatBytes,
} from "@my-notes/shared";
import { Alert, Descriptions, Modal, Radio, Typography } from "antd";
import { memo } from "react";

export type ImportModalProps = {
  open: boolean;
  fileName: string;
  targetName: string;
  preflight: ImportPreflightResult | null;
  result: ImportResult | null;
  strategy: OnConflictStrategy;
  loading: boolean;
  onStrategyChange: (strategy: OnConflictStrategy) => void;
  onConfirm: () => void;
  onClose: () => void;
};

/** 导入前先展示预检结果，确认后执行；执行完在同一弹窗里给出明细。 */
export const ImportModal = memo(function ImportModal({
  open,
  fileName,
  targetName,
  preflight,
  result,
  strategy,
  loading,
  onStrategyChange,
  onConfirm,
  onClose,
}: ImportModalProps) {
  const quotaBlocked = preflight !== null && !preflight.quotaOk;

  return (
    <Modal
      open={open}
      title={result ? "导入完成" : "导入预检"}
      okText={result ? "知道了" : "开始导入"}
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: !result && (preflight === null || quotaBlocked) }}
      cancelButtonProps={{ style: result ? { display: "none" } : undefined }}
      onOk={result ? onClose : onConfirm}
      onCancel={onClose}
    >
      <Typography.Paragraph type="secondary">
        导入包：{fileName} → 目标目录：{targetName}
      </Typography.Paragraph>

      {result ? (
        <>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="新建文件夹">{result.createdFolders}</Descriptions.Item>
            <Descriptions.Item label="新建文件">{result.createdFiles}</Descriptions.Item>
            <Descriptions.Item label="覆盖文件">{result.overwrittenFiles}</Descriptions.Item>
            <Descriptions.Item label="跳过">{result.skipped.length}</Descriptions.Item>
            <Descriptions.Item label="失败">{result.failed.length}</Descriptions.Item>
          </Descriptions>
          {result.failed.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              title="部分条目未能导入"
              description={
                <ul className="m-0 pl-4">
                  {result.failed.slice(0, 5).map((item) => (
                    <li key={item.path}>
                      {item.path}：{item.message}
                    </li>
                  ))}
                </ul>
              }
            />
          ) : null}
        </>
      ) : (
        <>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="文件夹">{preflight?.folderCount ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="文件">{preflight?.fileCount ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="总大小">
              {preflight ? formatBytes(preflight.totalBytes) : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="同名冲突">{preflight?.conflicts.length ?? 0}</Descriptions.Item>
          </Descriptions>

          {quotaBlocked ? (
            <Alert className="mb-3" type="error" showIcon title="存储空间不足，无法导入" />
          ) : null}

          {preflight && preflight.conflicts.length > 0 ? (
            <Alert
              className="mb-3"
              type="warning"
              showIcon
              title={`目标目录已存在：${preflight.conflicts.slice(0, 5).join("、")}`}
            />
          ) : null}

          <div>
            <Typography.Text className="mr-2">同名处理</Typography.Text>
            <Radio.Group
              value={strategy}
              onChange={(event) => onStrategyChange(event.target.value as OnConflictStrategy)}
            >
              <Radio value={OnConflictStrategy.RENAME}>保留副本</Radio>
              <Radio value={OnConflictStrategy.OVERWRITE}>覆盖</Radio>
              <Radio value={OnConflictStrategy.SKIP}>跳过</Radio>
            </Radio.Group>
          </div>
        </>
      )}
    </Modal>
  );
});
