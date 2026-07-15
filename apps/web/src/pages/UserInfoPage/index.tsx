import { Typography } from "antd";

import { useFsBackup } from "@/hooks/useFsBackup";

import { UserInfoPanel } from "./components/UserInfoPanel";

export function UserInfoPage() {
  const backup = useFsBackup();

  return (
    <>
      <input {...backup.importInputProps} />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <Typography.Title level={4} className="!mb-0">
          用户信息
        </Typography.Title>
        <UserInfoPanel
          displayName="本地账户"
          onExport={backup.exportBackup}
          onImport={backup.openImportPicker}
        />
      </div>
    </>
  );
}

export default UserInfoPage;
