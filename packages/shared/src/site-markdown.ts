/**
 * 站点「整页 Markdown 文档」在 `site_items.name` 上的保留值。
 * Web「站点整页」页读写该条目；其它 UI 应过滤，避免与逐条录入混淆。
 */
export const SITE_MARKDOWN_DOCUMENT_ITEM_NAME = "__site_markdown_document__" as const;

/**
 * 项目「整页 Markdown 文档」（仅 `projectId`、无 `siteId` 的 `site_items` 行）的保留 `name`。
 * Web「项目文档」页读写；项目信息区列表等应过滤。
 */
export const PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME = "__project_markdown_document__" as const;
