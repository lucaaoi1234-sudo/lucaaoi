"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { errorMessage } from "@/lib/client/api";
import { loginSchema, registerSchema } from "@/lib/validation/schemas";
import { Alert, Button, Card, Field, inputClass } from "./ui";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const collect = (error: { issues: { path: PropertyKey[]; message: string }[] }) => {
      const errors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
      }
      return errors;
    };

    let action: () => Promise<void>;
    if (isRegister) {
      const check = registerSchema.safeParse({ email, password, displayName });
      if (!check.success) {
        setFieldErrors(collect(check.error));
        return;
      }
      action = () => register(check.data.email, check.data.password, check.data.displayName);
    } else {
      const check = loginSchema.safeParse({ email, password });
      if (!check.success) {
        setFieldErrors(collect(check.error));
        return;
      }
      action = () => login(check.data.email, check.data.password);
    }

    setFieldErrors({});
    setBusy(true);
    try {
      await action();
      router.push("/");
      router.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-md">
      <Card
        title={isRegister ? "Tạo tài khoản" : "Đăng nhập"}
        subtitle={
          isRegister
            ? "Tài khoản giúp lưu lịch sử luyện tập lâu dài và tham gia bảng xếp hạng."
            : "Đăng nhập để đồng bộ lịch sử và xếp hạng. Khách vẫn có thể chơi không cần tài khoản."
        }
      >
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {isRegister && (
            <Field label="Tên hiển thị" error={fieldErrors.displayName}>
              <input
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                maxLength={40}
                placeholder="VD: NovaSniper"
              />
            </Field>
          )}
          <Field label="Email" error={fieldErrors.email}>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="ban@example.com"
            />
          </Field>
          <Field
            label="Mật khẩu"
            error={fieldErrors.password}
            hint={isRegister ? "Tối thiểu 8 ký tự." : undefined}
          >
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </Field>

          {formError && <Alert tone="error">{formError}</Alert>}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? "Đang xử lý…" : isRegister ? "Đăng ký" : "Đăng nhập"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
          <Link href={isRegister ? "/login" : "/register"} className="text-neon hover:underline">
            {isRegister ? "Đăng nhập" : "Đăng ký ngay"}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-500">
          <Link href="/train" className="hover:text-slate-300">
            Chơi thử với tư cách khách →
          </Link>
        </p>
      </Card>
    </div>
  );
}
