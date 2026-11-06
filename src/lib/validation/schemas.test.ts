import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, sessionSubmitSchema, settingsSchema } from "./schemas";

const validSession = {
  mode: "FLICK" as const,
  difficulty: "NORMAL" as const,
  durationSec: 60,
  score: 800,
  shots: 40,
  hits: 30,
  maxStreak: 9,
  targetsSpawned: 35,
  avgTimeToHitMs: 640,
};

describe("sessionSubmitSchema", () => {
  it("chấp nhận buổi tập hợp lệ và tự suy ra misses/accuracy phía server (không nhận từ client)", () => {
    const parsed = sessionSubmitSchema.parse(validSession);
    expect(parsed.hits).toBe(30);
    expect(parsed).not.toHaveProperty("misses");
    expect(parsed).not.toHaveProperty("accuracy");
    expect(parsed.avgReactionMs).toBeNull();
  });

  it("từ chối userId hoặc trường lạ (schema strict)", () => {
    expect(sessionSubmitSchema.safeParse({ ...validSession, userId: "someone-else" }).success).toBe(false);
    expect(sessionSubmitSchema.safeParse({ ...validSession, accuracy: 100 }).success).toBe(false);
  });

  it("từ chối thời lượng ngoài danh sách cho phép", () => {
    expect(sessionSubmitSchema.safeParse({ ...validSession, durationSec: 45 }).success).toBe(false);
  });

  it("từ chối điểm số vượt mức có thể đạt được (chống gian lận điểm)", () => {
    const res = sessionSubmitSchema.safeParse({ ...validSession, hits: 2, shots: 2, score: 5000, targetsSpawned: 2 });
    expect(res.success).toBe(false);
  });

  it("từ chối số lần trúng lớn hơn số lần bắn", () => {
    const res = sessionSubmitSchema.safeParse({ ...validSession, hits: 50, shots: 40 });
    expect(res.success).toBe(false);
  });

  it("từ chối tốc độ bắn bất thường (vượt 20 lần/giây)", () => {
    const res = sessionSubmitSchema.safeParse({ ...validSession, shots: 5000, hits: 0, maxStreak: 0, score: 0, targetsSpawned: 0 });
    expect(res.success).toBe(false);
  });

  it("từ chối số âm và số thập phân ở trường đếm", () => {
    expect(sessionSubmitSchema.safeParse({ ...validSession, shots: -1 }).success).toBe(false);
    expect(sessionSubmitSchema.safeParse({ ...validSession, hits: 1.5 }).success).toBe(false);
  });

  it("yêu cầu thời gian phản ứng với chế độ Reaction khi có lượt trúng", () => {
    const res = sessionSubmitSchema.safeParse({
      ...validSession,
      mode: "REACTION",
      avgTimeToHitMs: null,
      avgReactionMs: null,
      targetsSpawned: 40,
      score: 300,
    });
    expect(res.success).toBe(false);
  });

  it("từ chối thời gian phản ứng không thể đạt được về mặt sinh lý", () => {
    const res = sessionSubmitSchema.safeParse({
      ...validSession,
      mode: "REACTION",
      avgTimeToHitMs: null,
      avgReactionMs: 12,
      targetsSpawned: 40,
      score: 300,
    });
    expect(res.success).toBe(false);
  });

  it("từ chối tracking có nhiều hơn một bia", () => {
    const res = sessionSubmitSchema.safeParse({
      ...validSession,
      mode: "TRACKING",
      avgTimeToHitMs: null,
      trackingPct: 40,
      targetsSpawned: 3,
      score: 100,
    });
    expect(res.success).toBe(false);
  });
});

describe("auth schemas", () => {
  it("chuẩn hoá email về chữ thường và cắt khoảng trắng", () => {
    const parsed = registerSchema.parse({ email: "  Player@Example.COM ", password: "password123", displayName: "Aim Pro" });
    expect(parsed.email).toBe("player@example.com");
  });

  it("yêu cầu mật khẩu tối thiểu 8 ký tự", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short", displayName: "Aim" }).success).toBe(false);
  });

  it("từ chối tên hiển thị chứa ký tự đặc biệt", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "password123", displayName: "<script>" }).success).toBe(false);
  });

  it("đăng nhập yêu cầu email hợp lệ", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  const valid = {
    sensitivity: 1,
    crosshairSize: 14,
    crosshairColor: "#7ff7ff",
    volume: 60,
    fov: 70,
    graphicsQuality: "MEDIUM" as const,
  };

  it("chấp nhận cài đặt hợp lệ", () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true);
  });

  it("từ chối màu tâm ngắm không đúng định dạng hex (chống chèn CSS)", () => {
    expect(settingsSchema.safeParse({ ...valid, crosshairColor: "red; background:url(x)" }).success).toBe(false);
  });

  it("từ chối FOV và âm lượng ngoài khoảng", () => {
    expect(settingsSchema.safeParse({ ...valid, fov: 200 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, volume: 101 }).success).toBe(false);
  });
});
