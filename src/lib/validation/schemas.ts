/**
 * Schema Zod dùng chung cho client và server.
 * Server KHÔNG tin tưởng dữ liệu từ client: mọi trường đều được kiểm tra kiểu, khoảng giá trị và
 * ràng buộc chéo (cross-field). Userid luôn lấy từ phiên đăng nhập, không bao giờ từ body.
 */

import { z } from "zod";
import { DIFFICULTIES, DURATIONS_SEC, MAX_CLICKS_PER_SECOND, TRAINING_MODES } from "../game/config";
import { maxPossibleScore } from "../game/scoring";

const MAX_TARGETS_SPAWNED_PER_SECOND = 10;
export const MAX_PASSWORD_BYTES = 72; // giới hạn của bcrypt

export const emailSchema = z
  .string({ error: "Vui lòng nhập email" })
  .trim()
  .toLowerCase()
  .max(254, "Email quá dài")
  .pipe(z.email({ error: "Email không hợp lệ" }));

export const passwordSchema = z
  .string({ error: "Vui lòng nhập mật khẩu" })
  .min(8, "Mật khẩu cần ít nhất 8 ký tự")
  .refine((v) => new TextEncoder().encode(v).length <= MAX_PASSWORD_BYTES, {
    error: `Mật khẩu tối đa ${MAX_PASSWORD_BYTES} byte`,
  });

export const displayNameSchema = z
  .string({ error: "Vui lòng nhập tên hiển thị" })
  .trim()
  .min(2, "Tên hiển thị cần ít nhất 2 ký tự")
  .max(24, "Tên hiển thị tối đa 24 ký tự")
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Tên chỉ gồm chữ, số, khoảng trắng, _ . -");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Vui lòng nhập mật khẩu" }).min(1, "Vui lòng nhập mật khẩu").max(MAX_PASSWORD_BYTES),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const modeSchema = z.enum(TRAINING_MODES, { error: "Chế độ không hợp lệ" });
export const difficultySchema = z.enum(DIFFICULTIES, { error: "Độ khó không hợp lệ" });
export const durationSchema = z.union(
  [z.literal(DURATIONS_SEC[0]), z.literal(DURATIONS_SEC[1]), z.literal(DURATIONS_SEC[2])],
  { error: "Thời lượng phải là 30, 60 hoặc 120 giây" },
);

const nonNegInt = (max: number, label: string) =>
  z.number({ error: `${label} phải là số` }).int(`${label} phải là số nguyên`).min(0).max(max);

/**
 * Buổi tập gửi lên server. Trường `misses` và `accuracy` không nhận từ client:
 * server tự tính từ `shots` và `hits`.
 */
export const sessionSubmitSchema = z
  .object({
    mode: modeSchema,
    difficulty: difficultySchema,
    durationSec: durationSchema,
    score: nonNegInt(1_000_000, "Điểm"),
    shots: nonNegInt(MAX_CLICKS_PER_SECOND * 120, "Số lần bắn"),
    hits: nonNegInt(MAX_CLICKS_PER_SECOND * 120, "Số lần trúng"),
    maxStreak: nonNegInt(MAX_CLICKS_PER_SECOND * 120, "Chuỗi trúng"),
    targetsSpawned: nonNegInt(MAX_TARGETS_SPAWNED_PER_SECOND * 120, "Số bia"),
    expired: nonNegInt(MAX_TARGETS_SPAWNED_PER_SECOND * 120, "Số bia hết hạn").default(0),
    falseStarts: nonNegInt(MAX_CLICKS_PER_SECOND * 120, "Số lần bắn sớm").default(0),
    avgReactionMs: z.number().min(80, "Thời gian phản ứng quá nhanh").max(10_000).nullable().default(null),
    bestReactionMs: z.number().int().min(80, "Thời gian phản ứng quá nhanh").max(10_000).nullable().default(null),
    avgTimeToHitMs: z.number().min(16, "Thời gian bắn trúng không hợp lệ").max(30_000).nullable().default(null),
    trackingPct: z.number().min(0).max(100).nullable().default(null),
    precisionPct: z.number().min(0).max(100).nullable().default(null),
  })
  .strict()
  .superRefine((s, ctx) => {
    const maxShots = MAX_CLICKS_PER_SECOND * s.durationSec;
    if (s.shots > maxShots) {
      ctx.addIssue({ code: "custom", path: ["shots"], message: "Số lần bắn vượt giới hạn hợp lý" });
    }
    if (s.hits > s.shots) {
      ctx.addIssue({ code: "custom", path: ["hits"], message: "Số lần trúng không thể lớn hơn số lần bắn" });
    }
    if (s.maxStreak > s.hits) {
      ctx.addIssue({ code: "custom", path: ["maxStreak"], message: "Chuỗi trúng không thể lớn hơn số lần trúng" });
    }
    if (s.mode !== "TRACKING" && s.hits > s.targetsSpawned) {
      ctx.addIssue({ code: "custom", path: ["hits"], message: "Số lần trúng vượt số bia đã xuất hiện" });
    }
    if (s.mode === "TRACKING" && s.targetsSpawned > 1) {
      ctx.addIssue({ code: "custom", path: ["targetsSpawned"], message: "Chế độ Tracking chỉ có 1 bia" });
    }
    if (s.score > maxPossibleScore(s.mode, s.durationSec, s.hits)) {
      ctx.addIssue({ code: "custom", path: ["score"], message: "Điểm số vượt mức có thể đạt được" });
    }
    if (s.mode === "TRACKING" && s.trackingPct === null) {
      ctx.addIssue({ code: "custom", path: ["trackingPct"], message: "Thiếu tỉ lệ bám bia" });
    }
    if (s.mode === "REACTION" && s.hits > 0 && s.avgReactionMs === null) {
      ctx.addIssue({ code: "custom", path: ["avgReactionMs"], message: "Thiếu thời gian phản ứng" });
    }
    if (s.mode === "REACTION" && s.bestReactionMs !== null && s.avgReactionMs !== null && s.bestReactionMs > s.avgReactionMs + 0.5) {
      ctx.addIssue({ code: "custom", path: ["bestReactionMs"], message: "Thời gian tốt nhất không hợp lệ" });
    }
  });
export type SessionSubmitInput = z.infer<typeof sessionSubmitSchema>;

export const sessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const leaderboardQuerySchema = z.object({
  mode: modeSchema,
  durationSec: z
    .union([z.literal("all"), z.coerce.number().pipe(durationSchema)])
    .default("all"),
});

export const graphicsQualitySchema = z.enum(["LOW", "MEDIUM", "HIGH"], { error: "Chất lượng đồ họa không hợp lệ" });
export type GraphicsQuality = z.infer<typeof graphicsQualitySchema>;

export const settingsSchema = z
  .object({
    sensitivity: z.number({ error: "Độ nhạy phải là số" }).min(0.1, "Độ nhạy tối thiểu 0.1").max(5, "Độ nhạy tối đa 5"),
    crosshairSize: z.number().int("Kích thước tâm ngắm phải là số nguyên").min(4).max(40),
    crosshairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Màu tâm ngắm phải dạng #RRGGBB"),
    volume: z.number().int().min(0).max(100),
    fov: z.number().int("FOV phải là số nguyên").min(50, "FOV tối thiểu 50").max(100, "FOV tối đa 100"),
    graphicsQuality: graphicsQualitySchema,
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SettingsInput = {
  sensitivity: 1,
  crosshairSize: 14,
  crosshairColor: "#7ff7ff",
  volume: 60,
  fov: 70,
  graphicsQuality: "MEDIUM",
};

/** Chuyển lỗi Zod thành danh sách thông báo dễ hiểu cho người dùng. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}
