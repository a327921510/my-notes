import { useCallback, useEffect } from "react";

import { driveApi } from "@/services/modules/drive";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUsageStore } from "@/stores/useUsageStore";

/** 读取并刷新当前账号的存储用量；写操作完成后调用 refresh。 */
export function useDriveUsage(autoLoad = false) {
  const token = useAuthStore((s) => s.token);
  const usage = useUsageStore((s) => s.usage);
  const setUsage = useUsageStore((s) => s.setUsage);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setUsage(await driveApi.usage());
    } catch {
      // 用量是辅助信息，失败时保持上一次的值，不打断主流程
    }
  }, [setUsage, token]);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  return { usage, refresh };
}
