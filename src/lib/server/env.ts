import "server-only";
import { z } from "zod";

/**
 * Biến môi trường chỉ dùng trên server. Được kiểm tra lười (lazy) để `next build`
 * không cần DATABASE_URL thật; lỗi cấu hình được báo rõ khi có request đầu tiên.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "Thiếu DATABASE_URL trong .env" })
    .min(1, "Thiếu DATABASE_URL trong .env")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      error: "DATABASE_URL phải bắt đầu bằng postgresql://",
    }),
  AUTH_SECRET: z
    .string({ error: "Thiếu AUTH_SECRET trong .env" })
    .min(32, "AUTH_SECRET phải có ít nhất 32 ký tự ngẫu nhiên")
    .refine((v) => !v.startsWith("replace-with"), { error: "Hãy thay AUTH_SECRET mặc định trong .env" }),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(7),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
});

export type ServerEnv = {
  databaseUrl: string;
  authSecret: string;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
};

let cached: ServerEnv | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join("; ");
    throw new ConfigError(`Cấu hình máy chủ chưa đúng: ${messages}`);
  }
  const isProd = process.env.NODE_ENV === "production";
  cached = {
    databaseUrl: parsed.data.DATABASE_URL,
    authSecret: parsed.data.AUTH_SECRET,
    sessionTtlSeconds: parsed.data.SESSION_TTL_DAYS * 24 * 60 * 60,
    cookieSecure: parsed.data.COOKIE_SECURE !== undefined ? parsed.data.COOKIE_SECURE === "true" : isProd,
  };
  return cached;
}
