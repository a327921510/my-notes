import { type TextDiffResult, diffLines } from "@my-notes/shared";
import { App } from "antd";
import { useCallback, useState } from "react";

import { docApi } from "@/services/modules/doc";

export type ServerSnapshot = {
  content: string;
  updatedAt: number;
};

/** 拉取服务端正文并在客户端算逐行差异；服务端不提供差异接口。 */
export function useMmdDiff(nodeId: string) {
  const { message } = App.useApp();
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [diff, setDiff] = useState<TextDiffResult | null>(null);
  const [loading, setLoading] = useState(false);

  /** oldText 为服务端版本、newText 为本机版本，保证同处服务端行排在本机行之前。 */
  const compare = useCallback(
    async (localText: string): Promise<{ snapshot: ServerSnapshot; diff: TextDiffResult } | null> => {
      setLoading(true);
      try {
        const result = await docApi.read(nodeId);
        const nextSnapshot = { content: result.content, updatedAt: result.node.updatedAt };
        const nextDiff = diffLines(nextSnapshot.content, localText);
        setSnapshot(nextSnapshot);
        setDiff(nextDiff);
        return { snapshot: nextSnapshot, diff: nextDiff };
      } catch (error) {
        message.error((error as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [message, nodeId],
  );

  const clear = useCallback(() => {
    setSnapshot(null);
    setDiff(null);
  }, []);

  return { snapshot, diff, loading, compare, clear };
}
