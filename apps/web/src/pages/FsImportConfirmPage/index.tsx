/**
 * 导入确认专属页：全宽；冲突裁决 / 仅本地处理 → 落库后跳转文件管理。
 */
import { Typography } from "antd";

import { useFsImportConfirm } from "@/hooks/useFsImportConfirm";

import { FsImportWizardPanel } from "./components/FsImportWizardPanel";

export function FsImportConfirmPage() {
  const confirm = useFsImportConfirm();

  if (!confirm.wizard) {
    return (
      <div className="w-full p-4">
        <Typography.Text type="secondary">正在跳转…</Typography.Text>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col gap-3 p-4">
      <div className="shrink-0">
        <Typography.Title level={4} className="!mb-1">
          导入确认
        </Typography.Title>
        {confirm.wizard.sourceFileName ? (
          <Typography.Text type="secondary" className="font-mono text-xs">
            源文件：{confirm.wizard.sourceFileName}
          </Typography.Text>
        ) : null}
      </div>
      <FsImportWizardPanel
        wizard={confirm.wizard}
        applying={confirm.applying}
        onCancel={confirm.cancelWizard}
        onConfirm={confirm.confirmImport}
        onConflictResolve={confirm.setConflictResolution}
        onAllConflictsKeepLeft={confirm.setAllConflictsKeepLeft}
        onAllConflictsKeepRight={confirm.setAllConflictsKeepRight}
        onLocalOnlyAction={confirm.setLocalOnlyAction}
        onAllLocalOnly={confirm.setAllLocalOnly}
      />
    </div>
  );
}

export default FsImportConfirmPage;
