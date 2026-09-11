import type { DriveNode, NodeBrief } from "@my-notes/shared";
import { useCallback, useEffect, useState } from "react";

import { driveApi } from "@/services/modules/drive";

export type SearchHit = DriveNode & { path: NodeBrief[] };

type SearchState = {
  loading: boolean;
  error: string | null;
  items: SearchHit[];
  total: number;
};

const INITIAL: SearchState = { loading: false, error: null, items: [], total: 0 };

/** 按名称搜索当前账号的全部节点；关键词为空时不发请求。 */
export function useDriveSearch(keyword: string) {
  const [state, setState] = useState<SearchState>(INITIAL);

  const reload = useCallback(async () => {
    const trimmed = keyword.trim();
    if (trimmed === "") {
      setState(INITIAL);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await driveApi.search(trimmed);
      setState({ loading: false, error: null, items: result.items, total: result.total });
    } catch (error) {
      setState({ ...INITIAL, error: (error as Error).message });
    }
  }, [keyword]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
