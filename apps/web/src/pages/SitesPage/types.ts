export type SiteItem = {
  id: string;
  name: string;
  content: string;
  /** 来自项目文档表格同步，站点页仅可复制 */
  readOnly?: boolean;
};

export type Site = {
  id: string;
  name: string;
  address: string;
  projectId?: string | null;
  version: number;
  items: SiteItem[];
};
