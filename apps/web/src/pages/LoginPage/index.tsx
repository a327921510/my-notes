import { App, Button, Card, Form, Input, Segmented, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { authApi } from "@/services/modules/auth";
import { useAuthStore } from "@/stores/useAuthStore";

const MIN_PASSWORD_LENGTH = 8;

type AuthMode = "login" | "register";

type FormValues = {
  email: string;
  password: string;
  confirmPassword?: string;
};

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm<FormValues>();
  const [mode, setMode] = useState<AuthMode>("login");
  const [submitting, setSubmitting] = useState(false);

  const token = useAuthStore((s) => s.token);
  const expired = useAuthStore((s) => s.expired);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearExpired = useAuthStore((s) => s.clearExpired);

  const from = (location.state as { from?: string } | null)?.from ?? "/drive";

  useEffect(() => {
    if (!expired) return;
    message.warning("登录已过期，请重新登录");
    clearExpired();
  }, [clearExpired, expired, message]);

  const modeOptions = useMemo(
    () => [
      { label: "登录", value: "login" as AuthMode },
      { label: "注册", value: "register" as AuthMode },
    ],
    [],
  );

  const handleModeChange = useCallback(
    (next: AuthMode) => {
      setMode(next);
      form.resetFields(["confirmPassword"]);
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        const payload = { email: values.email.trim(), password: values.password };
        const result = mode === "login" ? await authApi.login(payload) : await authApi.register(payload);
        setAuth(result.token, result.user);
        message.success(mode === "login" ? "登录成功" : "注册成功");
        navigate(from, { replace: true });
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [from, message, mode, navigate, setAuth],
  );

  if (token) return <Navigate to={from} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-4">
      <Card className="w-full max-w-[420px]" variant="borderless">
        <div className="mb-6 text-center">
          <Typography.Title level={3} className="!mb-1">
            My Drive
          </Typography.Title>
          <Typography.Text type="secondary">账号隔离的个人云盘</Typography.Text>
        </div>

        <Segmented<AuthMode>
          block
          className="mb-5"
          options={modeOptions}
          value={mode}
          onChange={handleModeChange}
        />

        <Form<FormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "请输入有效的邮箱地址" },
            ]}
          >
            <Input autoComplete="username" placeholder="you@example.com" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              ...(mode === "register"
                ? [{ min: MIN_PASSWORD_LENGTH, message: `密码至少 ${MIN_PASSWORD_LENGTH} 位` }]
                : []),
            ]}
          >
            <Input.Password
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
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
                ({ getFieldValue }) => ({
                  validator(_rule, value) {
                    if (!value || value === getFieldValue("password")) return Promise.resolve();
                    return Promise.reject(new Error("两次输入的密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" placeholder="再次输入密码" size="large" />
            </Form.Item>
          ) : null}

          <Button block htmlType="submit" loading={submitting} size="large" type="primary">
            {mode === "login" ? "登录" : "注册并进入"}
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default LoginPage;
