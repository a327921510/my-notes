/**
 * 导入确认会话：跨路由暂存解析后的备份计划（避免把大 JSON 塞进 location.state）。
 */
import type { HunkResolution } from "@my-notes/shared";

import type { FsBackupPayload, FsImportPlan } from "./types";

export type ImportWizardState = {
  payload: FsBackupPayload;
  plan: FsImportPlan;
  conflictResolutions: Record<string, Record<number, HunkResolution>>;
  localOnlyActions: Record<string, "keep" | "delete">;
  /** 源文件名，便于页眉展示 */
  sourceFileName?: string;
};

let pending: ImportWizardState | null = null;

export function setImportSession(state: ImportWizardState): void {
  pending = state;
}

export function getImportSession(): ImportWizardState | null {
  return pending;
}

export function clearImportSession(): void {
  pending = null;
}

export function updateImportSession(
  updater: (prev: ImportWizardState) => ImportWizardState,
): ImportWizardState | null {
  if (!pending) return null;
  pending = updater(pending);
  return pending;
}
