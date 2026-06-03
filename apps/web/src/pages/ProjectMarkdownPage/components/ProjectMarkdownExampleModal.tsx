import { Button, Modal, Typography } from "antd";
import { memo, useCallback, useState } from "react";

const CREDENTIAL_TABLE_EXAMPLE = `| 地址 | 账号 | 密码 | 备注 |
| --- | --- | --- | --- |
| https://a.com | user1 | *** | 测试 |`;

const CODE_REPO_TABLE_EXAMPLE = `| 域名 | 代码仓库 | 代码路径(本地) | 备注 |
| --- | --- | --- | --- |
| github.com | org/repo | D:\\project\\foo | 本地克隆 |`;

export const ProjectMarkdownExampleModal = memo(function ProjectMarkdownExampleModal() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <Typography.Link className="text-xs" onClick={handleOpen}>
        查看示例
      </Typography.Link>
      <Modal
        title="项目 Markdown 示例"
        open={open}
        onCancel={handleClose}
        footer={
          <Button type="primary" onClick={handleClose}>
            知道了
          </Button>
        }
        width={640}
        destroyOnClose
      >
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-[#595959]">
          <section>
            <Typography.Text strong>凭证表</Typography.Text>
            <p className="mt-1 mb-2">
              管道表表头须依次为「地址」「账号」「密码」「备注」；阅读时转为专用表格，「账号」「密码」可点击复制。
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[#f5f5f5] p-3 text-xs leading-relaxed text-[#262626]">
              {CREDENTIAL_TABLE_EXAMPLE}
            </pre>
          </section>
          <section>
            <Typography.Text strong>代码仓库表</Typography.Text>
            <p className="mt-1 mb-2">
              表头须包含「域名」「代码仓库」「代码路径(本地)」「备注」（列顺序可任意）；本地路径在桌面版可点击打开资源管理器。
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[#f5f5f5] p-3 text-xs leading-relaxed text-[#262626]">
              {CODE_REPO_TABLE_EXAMPLE}
            </pre>
          </section>
          <section>
            <Typography.Text strong>Windows 路径</Typography.Text>
            <p className="mt-1">
              正文或表格「地址」「代码路径(本地)」列中的绝对路径（如{" "}
              <code className="rounded bg-[#f5f5f5] px-1">D:\project\foo</code>
              ）在桌面版可点击打开资源管理器；浏览器中仅显示为文本。
            </p>
          </section>
        </div>
      </Modal>
    </>
  );
});
