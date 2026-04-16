export type SyncedRow =
  | { key: string; kind: "note"; title: string; id: string; cloudId?: string; updatedAt: number }
  | {
      key: string;
      kind: "snippet";
      title: string;
      id: string;
      cloudId?: string;
      updatedAt: number;
      sourceDomain: string;
    };
