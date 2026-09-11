import { Input } from "antd";
import { memo } from "react";

export type DocEditorPanelProps = {
  value: string;
  onChange: (value: string) => void;
};

const PLACEHOLDER = [
  "在此编写 .mmd 文档，语法同 Markdown。",
  "",
  "表头依次为 地址 / 账号 / 密码 / 备注 的表格会在预览态渲染为凭据表：",
  "| 地址 | 账号 | 密码 | 备注 |",
  "| --- | --- | --- | --- |",
  "| https://example.com | admin | secret | 测试环境 |",
].join("\n");

/** Markdown 源码编辑，不做所见即所得。 */
export const DocEditorPanel = memo(function DocEditorPanel({ value, onChange }: DocEditorPanelProps) {
  return (
    <Input.TextArea
      className="h-full font-mono"
      data-testid="doc.editor"
      value={value}
      spellCheck={false}
      placeholder={PLACEHOLDER}
      onChange={(event) => onChange(event.target.value)}
      styles={{ textarea: { height: "100%", resize: "none" } }}
    />
  );
});
