/**
 * 导入确认页：读取 importSession，裁决冲突并落库。
 */
import { App } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  applyFsImport,
  clearImportSession,
  getImportSession,
  updateImportSession,
  type ConflictResolutionResult,
  type ImportWizardState,
  type LocalOnlyDecision,
} from "@/services/fsBackup";
import {
  applyHunkResolutions,
  computeTextDiff,
  type HunkResolution,
} from "@my-notes/shared";

function buildConflictResults(
  plan: ImportWizardState["plan"],
  conflictResolutions: ImportWizardState["conflictResolutions"],
): ConflictResolutionResult[] {
  return plan.conflicts.map((c) => {
    const diff = computeTextDiff(c.localContent, c.incomingContent);
    const merged = applyHunkResolutions(
      c.localContent,
      c.incomingContent,
      diff.hunks,
      conflictResolutions[c.path] ?? {},
    );
    return {
      path: c.path,
      kind: c.kind,
      localFileId: c.localFileId,
      contentText: merged,
    };
  });
}

function buildLocalOnlyDecisions(
  plan: ImportWizardState["plan"],
  actions: ImportWizardState["localOnlyActions"],
): LocalOnlyDecision[] {
  return plan.localOnly.map((item) => ({
    path: item.path,
    fileId: item.fileId,
    action: actions[item.path] ?? "keep",
  }));
}

export function useFsImportConfirm() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [wizard, setWizard] = useState<ImportWizardState | null>(() => getImportSession());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!getImportSession()) {
      message.warning("没有待确认的导入，请先选择备份文件");
      navigate("/user", { replace: true });
    }
  }, [message, navigate]);

  const sync = useCallback((next: ImportWizardState | null) => {
    setWizard(next);
  }, []);

  const cancelWizard = useCallback(() => {
    clearImportSession();
    setWizard(null);
    navigate("/user");
  }, [navigate]);

  const setConflictResolution = useCallback(
    (path: string, hunkIndex: number, resolution: HunkResolution) => {
      const next = updateImportSession((prev) => {
        const prevForPath = prev.conflictResolutions[path] ?? {};
        return {
          ...prev,
          conflictResolutions: {
            ...prev.conflictResolutions,
            [path]: { ...prevForPath, [hunkIndex]: resolution },
          },
        };
      });
      sync(next);
    },
    [sync],
  );

  const setAllConflictsKeepRight = useCallback(() => {
    const next = updateImportSession((prev) => {
      const mapAll: Record<string, Record<number, HunkResolution>> = {
        ...prev.conflictResolutions,
      };
      for (const c of prev.plan.conflicts) {
        const diff = computeTextDiff(c.localContent, c.incomingContent);
        const map: Record<number, HunkResolution> = {};
        diff.hunks.forEach((_, i) => {
          map[i] = { mode: "keepRight" };
        });
        mapAll[c.path] = map;
      }
      return { ...prev, conflictResolutions: mapAll };
    });
    sync(next);
  }, [sync]);

  const setAllConflictsKeepLeft = useCallback(() => {
    const next = updateImportSession((prev) => {
      const mapAll: Record<string, Record<number, HunkResolution>> = {
        ...prev.conflictResolutions,
      };
      for (const c of prev.plan.conflicts) {
        const diff = computeTextDiff(c.localContent, c.incomingContent);
        const map: Record<number, HunkResolution> = {};
        diff.hunks.forEach((_, i) => {
          map[i] = { mode: "keepLeft" };
        });
        mapAll[c.path] = map;
      }
      return { ...prev, conflictResolutions: mapAll };
    });
    sync(next);
  }, [sync]);

  const setLocalOnlyAction = useCallback(
    (path: string, action: "keep" | "delete") => {
      const next = updateImportSession((prev) => ({
        ...prev,
        localOnlyActions: { ...prev.localOnlyActions, [path]: action },
      }));
      sync(next);
    },
    [sync],
  );

  const setAllLocalOnly = useCallback(
    (action: "keep" | "delete") => {
      const next = updateImportSession((prev) => {
        const map: Record<string, "keep" | "delete"> = {};
        for (const item of prev.plan.localOnly) {
          map[item.path] = action;
        }
        return { ...prev, localOnlyActions: map };
      });
      sync(next);
    },
    [sync],
  );

  const confirmImport = useCallback(async () => {
    const current = getImportSession();
    if (!current) return;
    setApplying(true);
    try {
      const stats = await applyFsImport({
        payload: current.payload,
        toCreate: current.plan.toCreate,
        conflictResults: buildConflictResults(
          current.plan,
          current.conflictResolutions,
        ),
        localOnlyDecisions: buildLocalOnlyDecisions(
          current.plan,
          current.localOnlyActions,
        ),
        unchangedCount: current.plan.unchangedCount,
      });
      clearImportSession();
      setWizard(null);
      message.success(
        [
          `新建 ${stats.filesCreated}`,
          `更新 ${stats.filesUpdated}`,
          `删除 ${stats.filesDeleted}`,
          `目录 +${stats.foldersCreated}`,
          `跳过相同 ${stats.unchanged}`,
        ].join("；"),
      );
      navigate("/files");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "导入写入失败");
    } finally {
      setApplying(false);
    }
  }, [message, navigate]);

  return {
    wizard,
    applying,
    cancelWizard,
    confirmImport,
    setConflictResolution,
    setAllConflictsKeepLeft,
    setAllConflictsKeepRight,
    setLocalOnlyAction,
    setAllLocalOnly,
  };
}
