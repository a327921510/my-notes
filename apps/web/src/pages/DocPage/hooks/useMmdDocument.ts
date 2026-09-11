import { ApiErrorCode, type DocStaleDetails, type DriveNode } from "@my-notes/shared";
import { App } from "antd";
import { useCallback, useEffect, useState } from "react";

import { docApi } from "@/services/modules/doc";
import { RequestError } from "@/services/request";

export type SaveOutcome =
  | { status: "saved" }
  | { status: "stale"; serverUpdatedAt: number }
  | { status: "failed"; message: string };

/** 文档正文、脏标记与基版本。基版本过期时不静默覆盖，交给差异对比处理。 */
export function useMmdDocument(nodeId: string) {
  const { message } = App.useApp();
  const [node, setNode] = useState<DriveNode | null>(null);
  const [draft, setDraft] = useState("");
  const [savedText, setSavedText] = useState("");
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await docApi.read(nodeId);
      setNode(result.node);
      setDraft(result.content);
      setSavedText(result.content);
      setBaseUpdatedAt(result.node.updatedAt);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (content: string, overrideBaseUpdatedAt?: number): Promise<SaveOutcome> => {
      setSaving(true);
      try {
        const result = await docApi.save(nodeId, {
          content,
          baseUpdatedAt: overrideBaseUpdatedAt ?? baseUpdatedAt ?? undefined,
        });
        setNode(result.node);
        setDraft(content);
        setSavedText(content);
        setBaseUpdatedAt(result.node.updatedAt);
        return { status: "saved" };
      } catch (requestError) {
        if (requestError instanceof RequestError && requestError.code === ApiErrorCode.DOC_STALE) {
          const details = requestError.details as DocStaleDetails | undefined;
          return { status: "stale", serverUpdatedAt: details?.serverUpdatedAt ?? 0 };
        }
        return { status: "failed", message: (requestError as Error).message };
      } finally {
        setSaving(false);
      }
    },
    [baseUpdatedAt, nodeId],
  );

  /** 采用服务端版本：只换编辑器内容与基版本，不发写请求。 */
  const adoptServerVersion = useCallback((content: string, serverUpdatedAt: number) => {
    setDraft(content);
    setSavedText(content);
    setBaseUpdatedAt(serverUpdatedAt);
    message.success("已采用服务端版本");
  }, [message]);

  return {
    node,
    draft,
    setDraft,
    dirty: draft !== savedText,
    baseUpdatedAt,
    loading,
    saving,
    error,
    reload: load,
    save,
    adoptServerVersion,
  };
}
