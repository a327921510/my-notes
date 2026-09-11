import { OnConflictStrategy } from "@my-notes/shared";
import { Button, Checkbox, Modal, Space, Typography } from "antd";
import { memo, useCallback, useState } from "react";

import type { ConflictChoice, ConflictRequest } from "../hooks/useDriveTransfer";

export type ConflictModalProps = {
  request: ConflictRequest | null;
};

/** 同名冲突时询问策略；「对本批全部应用」把选择带到后续文件。 */
export const ConflictModal = memo(function ConflictModal({ request }: ConflictModalProps) {
  const [applyToAll, setApplyToAll] = useState(false);

  const choose = useCallback(
    (strategy: ConflictChoice["strategy"]) => {
      request?.resolve({ strategy, applyToAll });
      setApplyToAll(false);
    },
    [applyToAll, request],
  );

  return (
    <Modal
      open={request !== null}
      title="目标位置已存在同名文件"
      closable
      maskClosable={false}
      onCancel={() => choose(null)}
      footer={
        <Space>
          <Button onClick={() => choose(null)}>取消上传</Button>
          <Button onClick={() => choose(OnConflictStrategy.SKIP)}>跳过</Button>
          <Button onClick={() => choose(OnConflictStrategy.OVERWRITE)} danger>
            覆盖
          </Button>
          <Button type="primary" onClick={() => choose(OnConflictStrategy.RENAME)}>
            保留副本
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph>
        「{request?.name}」已存在。覆盖会替换原文件内容且不可恢复；保留副本会在名称后追加序号。
      </Typography.Paragraph>
      {request && request.remaining > 1 ? (
        <Checkbox checked={applyToAll} onChange={(event) => setApplyToAll(event.target.checked)}>
          对本批剩余 {request.remaining} 个文件全部应用
        </Checkbox>
      ) : null}
    </Modal>
  );
});
