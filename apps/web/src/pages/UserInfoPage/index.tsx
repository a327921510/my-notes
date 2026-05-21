import { Typography } from "antd";

import { useSiteProjectBackup } from "@/hooks/useSiteProjectBackup";

import { UserInfoPanel } from "./components/UserInfoPanel";

export function UserInfoPage() {
  const backup = useSiteProjectBackup();

  return (
    <>
      <input {...backup.importInputProps} />
      <div className="mx-auto max-w-3xl p-6">
        <Typography.Title level={4} className="!mb-6">
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
