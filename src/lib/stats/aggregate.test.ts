import { describe, expect, it } from "vitest";
import { aggregateSessions, average, type SessionRecord, TREND_LIMIT } from "./aggregate";

function session(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    mode: "FLICK",
    difficulty: "NORMAL",
    durationSec: 60,
    score: 500,
    shots: 20,
    hits: 10,
    misses: 10,
    accuracy: 50,
    maxStreak: 4,
    avgReactionMs: null,
    bestReactionMs: null,
    avgTimeToHitMs: 600,
    trackingPct: null,
    precisionPct: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateSessions", () => {
  it("trả về trạng thái rỗng khi chưa có buổi tập nào", () => {
    const s = aggregateSessions([]);
    expect(s.totalSessions).toBe(0);
    expect(s.overallAccuracy).toBe(0);
    expect(s.lastPlayedAt).toBeNull();
    expect(s.trend).toEqual([]);
    expect(s.byMode.FLICK.sessions).toBe(0);
    expect(s.byMode.FLICK.avgTimeToHitMs).toBeNull();
  });

  it("tính tổng và độ chính xác toàn cục theo số lần bắn/trúng (không lấy trung bình của các phần trăm)", () => {
    const s = aggregateSessions([
      session({ shots: 10, hits: 10, misses: 0, accuracy: 100 }),
      session({ shots: 90, hits: 0, misses: 90, accuracy: 0 }),
    ]);
    expect(s.totalShots).toBe(100);
    expect(s.totalHits).toBe(10);
    expect(s.totalMisses).toBe(90);
    expect(s.overallAccuracy).toBe(10);
    expect(s.totalPlayTimeSec).toBe(120);
  });

  it("lấy điểm cao nhất và chuỗi trúng cao nhất trên toàn bộ buổi tập", () => {
    const s = aggregateSessions([
      session({ score: 900, maxStreak: 3 }),
      session({ score: 1200, maxStreak: 7, mode: "PRECISION", avgTimeToHitMs: null }),
    ]);
    expect(s.bestScore).toBe(1200);
    expect(s.bestStreak).toBe(7);
  });

  it("thống kê riêng cho từng chế độ, gồm thời gian phản ứng tốt nhất", () => {
    const s = aggregateSessions([
      session({
        mode: "REACTION",
        avgTimeToHitMs: null,
        avgReactionMs: 300,
        bestReactionMs: 220,
        score: 700,
      }),
      session({
        mode: "REACTION",
        avgTimeToHitMs: null,
        avgReactionMs: 260,
        bestReactionMs: 240,
        score: 800,
      }),
    ]);
    expect(s.byMode.REACTION.sessions).toBe(2);
    expect(s.byMode.REACTION.avgReactionMs).toBe(280);
    expect(s.byMode.REACTION.bestReactionMs).toBe(220);
    expect(s.byMode.REACTION.bestScore).toBe(800);
    expect(s.byMode.REACTION.avgScore).toBe(750);
    expect(s.byMode.FLICK.sessions).toBe(0);
  });

  it("trend chỉ giữ tối đa TREND_LIMIT buổi gần nhất, theo thứ tự cũ → mới", () => {
    const many = Array.from({ length: TREND_LIMIT + 5 }, (_, i) =>
      session({ createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), score: i }),
    );
    const s = aggregateSessions([...many].reverse());
    expect(s.trend).toHaveLength(TREND_LIMIT);
    expect(s.trend[0]?.score).toBe(5);
    expect(s.trend[TREND_LIMIT - 1]?.score).toBe(TREND_LIMIT + 4);
  });

  it("lastPlayedAt là thời điểm mới nhất", () => {
    const s = aggregateSessions([
      session({ createdAt: "2026-02-01T00:00:00.000Z" }),
      session({ createdAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(s.lastPlayedAt).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("average", () => {
  it("trả về null cho danh sách rỗng và làm tròn 2 chữ số", () => {
    expect(average([])).toBeNull();
    expect(average([1, 2, 2])).toBe(1.67);
  });
});
