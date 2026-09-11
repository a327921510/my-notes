import type { DriveNode, NodeBrief, NodeSortField, SortOrder } from "@my-notes/shared";
import { useCallback, useEffect, useState } from "react";

import { driveApi } from "@/services/modules/drive";

export type DriveListParams = {
  folderId: string | null;
  sort: NodeSortField;
  order: SortOrder;
};

type DriveListState = {
  loading: boolean;
  error: string | null;
  parent: DriveNode | null;
  path: NodeBrief[];
  nodes: DriveNode[];
};

const INITIAL: DriveListState = { loading: true, error: null, parent: null, path: [], nodes: [] };

/** 当前目录的内容列表与面包屑。 */
export function useDriveList({ folderId, sort, order }: DriveListParams) {
  const [state, setState] = useState<DriveListState>(INITIAL);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await driveApi.listNodes({ parentId: folderId, sort, order });
      setState({
        loading: false,
        error: null,
        parent: result.parent,
        path: result.path,
        nodes: result.nodes,
      });
    } catch (error) {
      setState({ ...INITIAL, loading: false, error: (error as Error).message });
    }
  }, [folderId, order, sort]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
