import { DriveChangeStatus } from "@my-notes/shared";

export type DiffStatusMeta = {
  letter: string;
  label: string;
  /** Tailwind classes for the leading status chip (text + background). */
  chipClass: string;
  /** Tailwind text color for counters. */
  textClass: string;
};

export const DIFF_STATUS_META: Record<DriveChangeStatus, DiffStatusMeta> = {
  [DriveChangeStatus.ADDED]: {
    letter: "A",
    label: "新增",
    chipClass: "text-[#1a7f37] bg-[#dafbe1]",
    textClass: "text-[#1a7f37]",
  },
  [DriveChangeStatus.MODIFIED]: {
    letter: "M",
    label: "修改",
    chipClass: "text-[#9a6700] bg-[#fff8c5]",
    textClass: "text-[#9a6700]",
  },
  [DriveChangeStatus.REMOVED]: {
    letter: "D",
    label: "删除",
    chipClass: "text-[#cf222e] bg-[#ffebe9]",
    textClass: "text-[#cf222e]",
  },
  [DriveChangeStatus.UNCHANGED]: {
    letter: "·",
    label: "未变",
    chipClass: "text-gray-500 bg-gray-100",
    textClass: "text-gray-500",
  },
};

export function splitPath(path: string): { dir: string; name: string } {
  const normalized = path.replace(/^\/+/, "");
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return { dir: "", name: normalized };
  return { dir: normalized.slice(0, idx + 1), name: normalized.slice(idx + 1) };
}
