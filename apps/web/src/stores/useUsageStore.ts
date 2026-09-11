import type { DriveUsage } from "@my-notes/shared";
import { create } from "zustand";

/** 用量在 Header 与账号页都要展示，且被云盘的写操作影响，故提到全局。 */
type UsageState = {
  usage: DriveUsage | null;
  setUsage: (usage: DriveUsage) => void;
  clear: () => void;
};

export const useUsageStore = create<UsageState>()((set) => ({
  usage: null,
  setUsage: (usage) => set({ usage }),
  clear: () => set({ usage: null }),
}));
