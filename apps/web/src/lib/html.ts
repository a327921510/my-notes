/** 富文本 HTML 转纯文本（搜索、标题摘要等） */
export function stripHtml(html: string): string {
  if (!html.includes("<")) return html;
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? d.innerText ?? "").replace(/\s+/g, " ").trim();
}
