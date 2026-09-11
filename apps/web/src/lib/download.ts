/** 触发浏览器下载。桌面端后续可换成原生保存对话框，调用点不变。 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 打开系统文件选择器，返回所选文件；取消时返回空数组。 */
export function pickFiles(options: { accept?: string; multiple?: boolean } = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options.multiple ?? false;
    if (options.accept) input.accept = options.accept;
    input.onchange = () => resolve(input.files ? Array.from(input.files) : []);
    input.oncancel = () => resolve([]);
    input.click();
  });
}
