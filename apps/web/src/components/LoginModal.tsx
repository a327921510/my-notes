import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal } from "antd";
import { useCallback, useEffect, useState } from "react";

import { authApi } from "@/services/modules/auth";
import { useAuthStore } from "@/stores/useAuthStore";

const MIN_PASSWORD_LENGTH = 8;

export type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type AuthMode = "login" | "register";

type LoginFormValues = {
  email: string;
  password: string;
  confirmPassword?: string;
};

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { message } = App.useApp();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [form] = Form.useForm<LoginFormValues>();

  useEffect(() => {
    if (!isOpen) {
      setMode("login");
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (values: LoginFormValues) => {
      setLoading(true);
      try {
        const res =
          mode === "register"
            ? await authApi.register({
                email: values.email,
                password: values.password,
              })
            : await authApi.login({
                email: values.email,
                password: values.password,
              });
        setAuth(res.data.token, res.data.user);
        message.success(mode === "register" ? "注册成功" : "登录成功");
        form.resetFields();
        onClose();
      } catch (err) {
        message.error((err as Error).message || "操作失败，请重试");
      } finally {
        setLoading(false);
      }
    },
    [setAuth, message, form, onClose, mode],
  );

  const handleCancel = useCallback(() => {
    form.resetFields();
    setMode("login");
    onClose();
  }, [form, onClose]);

  const toggleMode = useCallback(() => {
    setMode((m: AuthMode) => (m === "login" ? "register" : "login"));
    form.resetFields(["password", "confirmPassword"]);
  }, [form]);

  return (
    <Modal
      title={mode === "register" ? "注册 My Notes" : "登录 My Notes"}
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
          rules={[
            { required: true, message: "请输入密码" },
            ...(mode === "register"
              ? [
                  {
                    min: MIN_PASSWORD_LENGTH,
                    message: `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
                  },
                ]
              : []),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            size="large"
          />
        </Form.Item>
        {mode === "register" ? (
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入密码" },
              ({ getFieldValue }: { getFieldValue: (n: string) => unknown }) => ({
                validator(_rule: unknown, value: unknown) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              size="large"
            />
          </Form.Item>
        ) : null}
        <Form.Item className="!mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            {mode === "register" ? "注册" : "登录"}
          </Button>
        </Form.Item>
        <div className="mt-3 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              还没有账号？
              <Button type="link" className="!p-0 !h-auto" onClick={toggleMode}>
                去注册
              </Button>
            </>
          ) : (
            <>
              已有账号？
              <Button type="link" className="!p-0 !h-auto" onClick={toggleMode}>
                去登录
              </Button>
            </>
          )}
        </div>
      </Form>
    </Modal>
  );
}
