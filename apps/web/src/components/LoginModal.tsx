import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal } from "antd";
import { useCallback, useState } from "react";

import { authApi } from "@/services/modules/auth";
import { useAuthStore } from "@/stores/useAuthStore";

export type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type LoginFormValues = {
  email: string;
  password: string;
};

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { message } = App.useApp();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<LoginFormValues>();

  const handleSubmit = useCallback(
    async (values: LoginFormValues) => {
      setLoading(true);
      try {
        const res = await authApi.login(values);
        setAuth(res.data.token, res.data.user);
        message.success("登录成功");
        form.resetFields();
        onClose();
      } catch (err) {
        message.error((err as Error).message || "登录失败，请重试");
      } finally {
        setLoading(false);
      }
    },
    [setAuth, message, form, onClose],
  );

  const handleCancel = useCallback(() => {
    form.resetFields();
    onClose();
  }, [form, onClose]);

  return (
    <Modal
      title="登录 My Notes"
      open={isOpen}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
        className="pt-4"
      >
        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: "请输入邮箱" },
            { type: "email", message: "请输入有效的邮箱地址" },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱"
            size="large"
          />
        </Form.Item>
        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: "请输入密码" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
          />
        </Form.Item>
        <Form.Item className="!mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            登录
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
