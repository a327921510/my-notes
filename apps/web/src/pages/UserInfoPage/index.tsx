import { Typography } from "antd";
import { useState } from "react";

import { LoginModal } from "@/components/LoginModal";
import { useSiteProjectBackup } from "@/hooks/useSiteProjectBackup";
import { useAuthStore } from "@/stores/useAuthStore";

import { UserInfoPanel } from "./components/UserInfoPanel";

export function UserInfoPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const backup = useSiteProjectBackup();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <input {...backup.importInputProps} />
      <div className="mx-auto max-w-3xl p-6">
        <Typography.Title level={4} className="!mb-6">
          用户信息
        </Typography.Title>
        <UserInfoPanel
          displayName={user ? user.email : "游客"}
          isLoggedIn={!!user}
          userId={user?.id ?? null}
          onLogin={() => setLoginOpen(true)}
          onLogout={() => logout()}
          onExport={backup.exportBackup}
          onImport={backup.openImportPicker}
        />
      </div>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

export default UserInfoPage;
