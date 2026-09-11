import { formatBytes } from "@my-notes/shared";
import { App, Button, Card, Descriptions, Form, Input, Progress, Typography } from "antd";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useDriveUsage } from "@/hooks/useDriveUsage";
import { authApi } from "@/services/modules/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUsageStore } from "@/stores/useUsageStore";

const MIN_PASSWORD_LENGTH = 8;

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function AccountPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<PasswordFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearUsage = useUsageStore((s) => s.clear);
  const { usage } = useDriveUsage(true);

  const handleChangePassword = useCallback(
    async (values: PasswordFormValues) => {
      setSubmitting(true);
      try {
        await authApi.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });
        form.resetFields();
        modal.success({
          title: "密码已修改",
          content: "为保证安全，当前会话已失效，请使用新密码重新登录。",
          okText: "去登录",
          onOk: () => {
            clearUsage();
            logout();
            navigate("/login", { replace: true });
          },
        });
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [clearUsage, form, logout, message, modal, navigate],
  );

  const usagePercent =
    usage && usage.quotaBytes > 0 ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100)) : 0;

  return (
    <div className="mx-auto h-full max-w-[760px] overflow-auto">
      <Card className="mb-3" title="账号信息">
        <Descriptions column={1} size="middle">
          <Descriptions.Item label="邮箱">{user?.email ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="文件 / 文件夹">
            {usage ? `${usage.fileCount} 个文件，${usage.folderCount} 个文件夹` : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="存储用量">
            {usage ? (
              <div className="w-full max-w-[420px]">
                <Progress percent={usagePercent} status={usagePercent >= 100 ? "exception" : "normal"} />
                <Typography.Text type="secondary">
                  已用 {formatBytes(usage.usedBytes)} / 共 {formatBytes(usage.quotaBytes)}，单文件上限{" "}
                  {formatBytes(usage.maxFileSizeBytes)}
                </Typography.Text>
              </div>
            ) : (
              "-"
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="修改密码">
        <Form<PasswordFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{ maxWidth: 420 }}
          onFinish={handleChangePassword}
        >
          <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: MIN_PASSWORD_LENGTH, message: `密码至少 ${MIN_PASSWORD_LENGTH} 位` },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_rule, value) {
                  if (!value || value === getFieldValue("newPassword")) return Promise.resolve();
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button htmlType="submit" loading={submitting} type="primary">
            修改密码
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default AccountPage;
