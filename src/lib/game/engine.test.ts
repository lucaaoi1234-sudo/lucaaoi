import { describe, expect, it } from "vitest";
import { TrainingEngine, type EngineEvent } from "./engine";
import { REACTION_PARAMS } from "./config";

const VIEWPORT = { aspect: 16 / 9, fovYDeg: 70 };

function makeEngine(mode: ConstructorParameters<typeof TrainingEngine>[0]["mode"], seed = 42, durationSec = 30) {
  const engine = new TrainingEngine({
    mode,
    difficulty: "NORMAL",
    durationSec,
    seed,
    viewport: VIEWPORT,
  });
  const events: EngineEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return { engine, events };
}

/** Chạy engine theo bước 16ms tới `toMs` (mô phỏng vòng lặp render). */
function runTo(engine: TrainingEngine, fromMs: number, toMs: number): number {
  let t = fromMs;
  while (t < toMs) {
    t = Math.min(toMs, t + 16);
    engine.tick(t, false);
  }
  return t;
}

describe("TrainingEngine – vòng đời", () => {
  it("không cho bắn khi chưa bắt đầu", () => {
    const { engine } = makeEngine("FLICK");
    expect(engine.shoot(10, null)).toBe(false);
    expect(engine.getSnapshot().shots).toBe(0);
  });

  it("tạm dừng không làm trôi thời gian của buổi tập", () => {
    const { engine } = makeEngine("PRECISION", 1, 30);
    engine.start(0);
    let t = runTo(engine, 0, 5000);
    engine.pause(t);
    t = 60_000; // người chơi tạm dừng 55 giây
    engine.resume(t);
    t = runTo(engine, t, t + 1000);
    expect(engine.getSnapshot().elapsedMs).toBeCloseTo(6000, -1);
    expect(engine.getStatus()).toBe("running");
  });

  it("kết thúc đúng khi hết thời lượng và phát sự kiện finish một lần", () => {
    const { engine, events } = makeEngine("FLICK", 3, 30);
    engine.start(0);
    runTo(engine, 0, 31_000);
    expect(engine.getStatus()).toBe("finished");
    expect(events.filter((e) => e.type === "finish")).toHaveLength(1);
    expect(engine.getResult().durationSec).toBe(30);
  });

  it("getResult ném lỗi khi buổi tập chưa kết thúc", () => {
    const { engine } = makeEngine("FLICK");
    engine.start(0);
    expect(() => engine.getResult()).toThrow();
  });

  it("từ chối cấu hình không hợp lệ", () => {
    expect(
      () => new TrainingEngine({ mode: "FLICK", difficulty: "EASY", durationSec: 0, seed: 1, viewport: VIEWPORT }),
    ).toThrow(RangeError);
  });
});

describe("TrainingEngine – Flick", () => {
  it("sinh bia sau thời gian chờ ban đầu và đặt bia trong khung hình", () => {
    const { engine, events } = makeEngine("FLICK");
    engine.start(0);
    runTo(engine, 0, 1000);
    const spawn = events.find((e) => e.type === "spawn");
    expect(spawn).toBeDefined();
    if (spawn?.type !== "spawn") throw new Error("missing spawn");
    expect(Math.abs(spawn.target.u)).toBeLessThanOrEqual(1);
    expect(Math.abs(spawn.target.v)).toBeLessThanOrEqual(1);
    expect(spawn.target.radiusNdc).toBeGreaterThan(0);
  });

  it("bắn trúng: cộng điểm, tăng chuỗi và ghi nhận thời gian bắn trúng", () => {
    const { engine, events } = makeEngine("FLICK");
    engine.start(0);
    const t = runTo(engine, 0, 500);
    const spawn = events.find((e) => e.type === "spawn");
    if (spawn?.type !== "spawn") throw new Error("missing spawn");
    const hit = engine.shoot(t + 200, { targetId: spawn.target.id, offsetRatio: 0 });
    expect(hit).toBe(true);
    const snap = engine.getSnapshot();
    expect(snap.hits).toBe(1);
    expect(snap.shots).toBe(1);
    expect(snap.accuracy).toBe(100);
    expect(snap.score).toBeGreaterThan(0);
    expect(snap.score).toBeLessThanOrEqual(100);
    expect(snap.streak).toBe(1);
    expect(snap.avgTimeToHitMs).not.toBeNull();
  });

  it("bắn trượt vẫn được ghi nhận là một lượt bắn và làm mất chuỗi trúng", () => {
    const { engine } = makeEngine("FLICK");
    engine.start(0);
    const t = runTo(engine, 0, 500);
    engine.shoot(t, null);
    const snap = engine.getSnapshot();
    expect(snap.shots).toBe(1);
    expect(snap.hits).toBe(0);
    expect(snap.misses).toBe(1);
    expect(snap.accuracy).toBe(0);
    expect(snap.streak).toBe(0);
  });

  it("bia hết hạn được tính là bỏ lỡ và không tính là lượt bắn", () => {
    const { engine, events } = makeEngine("FLICK");
    engine.start(0);
    runTo(engine, 0, 5000);
    expect(events.some((e) => e.type === "expire")).toBe(true);
    expect(engine.getSnapshot().expired).toBeGreaterThan(0);
    expect(engine.getSnapshot().shots).toBe(0);
  });

  it("không bao giờ có nhiều bia hơn số lượng tối đa của độ khó", () => {
    const engine = new TrainingEngine({ mode: "FLICK", difficulty: "HARD", durationSec: 30, seed: 9, viewport: VIEWPORT });
    engine.start(0);
    let max = 0;
    let t = 0;
    while (t < 20_000) {
      t += 16;
      engine.tick(t, false);
      max = Math.max(max, engine.getTargets().length);
    }
    expect(max).toBeLessThanOrEqual(2);
  });

  it("bia mới không chồng lên nhân vật (vùng loại trừ)", () => {
    const engine = new TrainingEngine({ mode: "FLICK", difficulty: "EASY", durationSec: 60, seed: 5, viewport: VIEWPORT });
    const exclusion = [{ x0: -1, y0: -1, x1: -0.2, y1: 0.3 }];
    engine.setExclusion(exclusion);
    engine.start(0);
    let t = 0;
    const seen: { u: number; v: number }[] = [];
    engine.subscribe((e) => {
      if (e.type === "spawn") seen.push({ u: e.target.u, v: e.target.v });
    });
    while (t < 30_000) {
      t += 16;
      engine.tick(t, false);
      // Giả lập người chơi bắn trúng mọi bia để sinh thêm bia.
      for (const target of engine.getTargets()) engine.shoot(t, { targetId: target.id, offsetRatio: 0.2 });
    }
    expect(seen.length).toBeGreaterThan(5);
    for (const p of seen) {
      const inside = p.u > -1.0 && p.u < -0.2 && p.v > -1 && p.v < 0.3;
      expect(inside).toBe(false);
    }
  });
});

describe("TrainingEngine – Reaction", () => {
  it("bắn sớm trước khi bia xuất hiện là false start và không tính điểm phản ứng", () => {
    const { engine, events } = makeEngine("REACTION");
    engine.start(0);
    engine.shoot(10, null);
    const miss = events.find((e) => e.type === "miss");
    expect(miss).toMatchObject({ type: "miss", reason: "falseStart" });
    expect(engine.getSnapshot().falseStarts).toBe(1);
    expect(engine.getSnapshot().avgReactionMs).toBeNull();
  });

  it("đo đúng thời gian phản ứng từ lúc bia xuất hiện", () => {
    const { engine, events } = makeEngine("REACTION", 7);
    engine.start(0);
    let t = 0;
    let spawnedAt = -1;
    while (t < 5000 && spawnedAt < 0) {
      t += 10;
      engine.tick(t, false);
      const spawn = events.find((e) => e.type === "spawn");
      if (spawn?.type === "spawn") spawnedAt = t;
    }
    expect(spawnedAt).toBeGreaterThan(0);
    const target = engine.getTargets()[0];
    if (!target) throw new Error("missing target");
    const reactionAt = spawnedAt + 250;
    engine.tick(reactionAt, false);
    engine.shoot(reactionAt, { targetId: target.id, offsetRatio: 0 });
    const snap = engine.getSnapshot();
    expect(snap.lastReactionMs).toBeCloseTo(250, 0);
    expect(snap.bestReactionMs).toBeCloseTo(250, 0);
    expect(snap.avgReactionMs).toBeCloseTo(250, 0);
  });

  it("hết thời gian chờ thì bia tự biến mất và trial kế tiếp được lên lịch trong khoảng ngẫu nhiên", () => {
    const { engine, events } = makeEngine("REACTION", 11);
    engine.start(0);
    runTo(engine, 0, 20_000);
    expect(events.filter((e) => e.type === "spawn").length).toBeGreaterThan(1);
    expect(engine.getSnapshot().expired).toBeGreaterThan(0);
    const p = REACTION_PARAMS.NORMAL;
    expect(p.minDelayMs).toBeGreaterThan(0);
  });
});

describe("TrainingEngine – Precision", () => {
  it("điểm precision cao hơn khi bắn gần tâm", () => {
    const a = makeEngine("PRECISION", 2);
    const b = makeEngine("PRECISION", 2);
    a.engine.start(0);
    b.engine.start(0);
    const ta = runTo(a.engine, 0, 500);
    const tb = runTo(b.engine, 0, 500);
    const ida = a.engine.getTargets()[0]?.id ?? -1;
    const idb = b.engine.getTargets()[0]?.id ?? -1;
    a.engine.shoot(ta, { targetId: ida, offsetRatio: 0 });
    b.engine.shoot(tb, { targetId: idb, offsetRatio: 0.9 });
    expect(a.engine.getSnapshot().score).toBeGreaterThan(b.engine.getSnapshot().score);
    expect(a.engine.getSnapshot().precisionPct).toBe(100);
    expect(b.engine.getSnapshot().precisionPct).toBeLessThan(20);
  });
});

describe("TrainingEngine – Tracking", () => {
  it("tạo đúng một bia di chuyển và cộng thời gian khi tâm ngắm nằm trên bia", () => {
    const { engine } = makeEngine("TRACKING", 4, 30);
    engine.start(0);
    expect(engine.getTargets()).toHaveLength(1);
    const before = engine.getTrackingTarget();
    let t = 0;
    for (let i = 0; i < 100; i++) {
      t += 20;
      engine.tick(t, true); // luôn bám trúng
    }
    const after = engine.getTrackingTarget();
    expect(before && after && (before.u !== after.u || before.v !== after.v)).toBe(true);
    const snap = engine.getSnapshot();
    expect(snap.trackingPct).toBe(100);
    expect(engine.getSnapshot().score).toBe(Math.floor(2000 / 10));
  });

  it("không bám thì không có điểm tracking", () => {
    const { engine } = makeEngine("TRACKING", 4, 30);
    engine.start(0);
    runTo(engine, 0, 5000);
    expect(engine.getSnapshot().score).toBe(0);
    expect(engine.getSnapshot().trackingPct).toBe(0);
  });

  it("click lên bia tracking được tính là lượt trúng nhưng không cộng thêm điểm", () => {
    const { engine } = makeEngine("TRACKING", 4, 30);
    engine.start(0);
    const target = engine.getTrackingTarget();
    if (!target) throw new Error("missing tracking target");
    engine.shoot(100, { targetId: target.id, offsetRatio: 0.1 });
    expect(engine.getSnapshot().hits).toBe(1);
    expect(engine.getSnapshot().score).toBe(0);
  });
});

describe("TrainingEngine – kết quả", () => {
  it("getResult trả về misses = shots − hits và accuracy nhất quán", () => {
    const { engine } = makeEngine("FLICK", 8, 30);
    engine.start(0);
    const t = runTo(engine, 0, 500);
    const target = engine.getTargets()[0];
    if (!target) throw new Error("missing target");
    engine.shoot(t, { targetId: target.id, offsetRatio: 0.3 });
    engine.shoot(t + 10, null);
    engine.shoot(t + 20, null);
    engine.finish(t + 30);
    const r = engine.getResult();
    expect(r.shots).toBe(3);
    expect(r.hits).toBe(1);
    expect(r.misses).toBe(2);
    expect(r.accuracy).toBeCloseTo(33.33, 2);
    expect(r.avgReactionMs).toBeNull();
    expect(r.trackingPct).toBeNull();
  });
});
