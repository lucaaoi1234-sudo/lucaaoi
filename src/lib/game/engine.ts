/**
 * Engine buổi luyện tập (không phụ thuộc React/Three).
 *
 * - Toàn bộ thời gian được đo bằng "đồng hồ hoạt động" (active clock) do bên gọi truyền vào `now` (ms).
 *   Thời gian bị tạm dừng không được tính vào thời lượng, phản ứng hay thời gian bám.
 * - Bên gọi (scene 3D hoặc fallback 2D) chịu trách nhiệm xác định trúng/trượt bằng raycast hoặc hình học
 *   và truyền kết quả vào `shoot()`; engine chỉ quyết định điểm số và trạng thái.
 */

import {
  FLICK_PARAMS,
  PRECISION_PARAMS,
  REACTION_PARAMS,
  TRACKING_PARAMS,
  type Difficulty,
  type TrainingMode,
} from "./config";
import { createRng, type Rng } from "./rng";
import { angularRadiusToNdc, type Rect, rectsOverlapCircle, type Viewport } from "./geometry";
import {
  accuracyPct,
  clamp as clampNumber,
  flickPoints,
  precisionPct,
  precisionPoints,
  reactionPoints,
  trackingPct,
  trackingPoints,
} from "./scoring";

export type EngineStatus = "idle" | "running" | "paused" | "finished";

export interface TargetView {
  readonly id: number;
  readonly kind: "static" | "tracking";
  /** Tâm bia (NDC). */
  readonly u: number;
  readonly v: number;
  /** Bán kính bia theo NDC-y. */
  readonly radiusNdc: number;
  /** Giá trị 0..1 để scene chọn chiều sâu cho bia (chỉ mang tính thẩm mỹ). */
  readonly depthT: number;
  readonly spawnAt: number;
  readonly expiresAt: number | null;
}

export type EngineEvent =
  | { type: "spawn"; target: TargetView }
  | {
      type: "hit";
      targetId: number;
      points: number;
      reactionMs: number | null;
      timeToHitMs: number | null;
      offsetRatio: number;
      streak: number;
    }
  | { type: "miss"; reason: "empty" | "falseStart" }
  | { type: "expire"; targetId: number }
  | { type: "finish" };

export type EngineListener = (event: EngineEvent) => void;

export interface EngineSnapshot {
  status: EngineStatus;
  elapsedMs: number;
  remainingMs: number;
  durationMs: number;
  score: number;
  shots: number;
  hits: number;
  misses: number;
  accuracy: number;
  streak: number;
  maxStreak: number;
  targetsSpawned: number;
  expired: number;
  lastReactionMs: number | null;
  bestReactionMs: number | null;
  avgReactionMs: number | null;
  avgTimeToHitMs: number | null;
  trackingPct: number;
  precisionPct: number | null;
  falseStarts: number;
}

export interface SessionResult {
  mode: TrainingMode;
  difficulty: Difficulty;
  durationSec: number;
  score: number;
  shots: number;
  hits: number;
  misses: number;
  accuracy: number;
  maxStreak: number;
  targetsSpawned: number;
  avgReactionMs: number | null;
  bestReactionMs: number | null;
  avgTimeToHitMs: number | null;
  trackingPct: number | null;
  precisionPct: number | null;
  expired: number;
  falseStarts: number;
}

export interface EngineConfig {
  mode: TrainingMode;
  difficulty: Difficulty;
  durationSec: number;
  seed: number;
  viewport: Viewport;
}

interface InternalTarget {
  id: number;
  kind: "static" | "tracking";
  u: number;
  v: number;
  radiusNdc: number;
  depthT: number;
  spawnAt: number;
  expiresAt: number | null;
  lifetimeMs: number;
}

// Các hằng số của đường bay tracking (đơn vị NDC).
const TRACK_AMP_U = 0.42;
const TRACK_AMP_V = 0.26;
const TRACK_CENTER_CANDIDATES: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.12],
  [0.3, 0.22],
  [-0.22, 0.2],
  [0.3, -0.12],
  [-0.3, -0.05],
  [0, 0.05],
];
const INITIAL_DELAY_MS = 400;
const MIN_SPAWN_SEPARATION = 0.45;

export class TrainingEngine {
  readonly mode: TrainingMode;
  readonly difficulty: Difficulty;
  readonly durationSec: number;
  readonly durationMs: number;

  private readonly rng: Rng;
  private viewport: Viewport;
  private exclusion: Rect[] = [];
  private status: EngineStatus = "idle";
  private activeMs = 0;
  private lastNow = 0;
  private nextId = 1;
  private targets: InternalTarget[] = [];
  private nextSpawnAt = INITIAL_DELAY_MS;
  private lastSpawn: { u: number; v: number } | null = null;
  private listeners = new Set<EngineListener>();

  // Trạng thái tracking
  private trackingTarget: InternalTarget | null = null;
  private trackCenter: [number, number] = [0, 0];
  private trackFreq: [number, number] = [1, 1];
  private trackPhase: [number, number] = [0, 0];
  private trackedMs = 0;
  private visibleMs = 0;

  // Số liệu buổi tập
  private score = 0;
  private shots = 0;
  private hits = 0;
  private streak = 0;
  private maxStreak = 0;
  private targetsSpawned = 0;
  private expired = 0;
  private falseStarts = 0;
  private reactionSumMs = 0;
  private reactionCount = 0;
  private bestReactionMs: number | null = null;
  private lastReactionMs: number | null = null;
  private timeToHitSumMs = 0;
  private timeToHitCount = 0;
  private offsetSum = 0;
  private offsetCount = 0;

  constructor(config: EngineConfig) {
    if (!Number.isFinite(config.durationSec) || config.durationSec <= 0) {
      throw new RangeError("durationSec phải là số dương");
    }
    if (!(config.viewport.aspect > 0) || !(config.viewport.fovYDeg > 0 && config.viewport.fovYDeg < 180)) {
      throw new RangeError("viewport không hợp lệ");
    }
    this.mode = config.mode;
    this.difficulty = config.difficulty;
    this.durationSec = config.durationSec;
    this.durationMs = config.durationSec * 1000;
    this.rng = createRng(config.seed);
    this.viewport = { ...config.viewport };
  }

  // ---------------------------------------------------------------- cấu hình

  /** Cập nhật khung nhìn (khi đổi kích thước cửa sổ hoặc FOV). */
  setViewport(viewport: Viewport): void {
    this.viewport = { ...viewport };
  }

  /** Vùng NDC mà bia không được xuất hiện (ví dụ vùng nhân vật đang chiếm). Chỉ nên đặt trước khi bắt đầu. */
  setExclusion(rects: readonly Rect[]): void {
    this.exclusion = rects.map((r) => ({ ...r }));
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- vòng đời

  start(now: number): void {
    if (this.status !== "idle") throw new Error("Buổi tập đã bắt đầu");
    this.status = "running";
    this.lastNow = now;
    if (this.mode === "TRACKING") this.setupTracking();
    if (this.mode === "REACTION") this.nextSpawnAt = this.randomDelay();
  }

  pause(now: number): void {
    if (this.status !== "running") return;
    this.advance(now, false);
    // advance() có thể đã kết thúc buổi tập nếu hết giờ đúng lúc tạm dừng.
    if (this.status === "running") this.status = "paused";
  }

  resume(now: number): void {
    if (this.status !== "paused") return;
    this.lastNow = now;
    this.status = "running";
  }

  /** Kết thúc sớm (người chơi bấm "Kết thúc"). */
  finish(now: number): void {
    if (this.status === "idle" || this.status === "finished") return;
    if (this.status === "running") this.advance(now, false);
    this.complete();
  }

  /**
   * Tiến đồng hồ tới `now`, sinh/xoá bia, cập nhật bia tracking.
   * @param aimOnTarget tâm ngắm có đang nằm trên bia tracking hay không (do raycast bên ngoài xác định).
   */
  tick(now: number, aimOnTarget = false): void {
    if (this.status !== "running") return;
    this.advance(now, aimOnTarget);
  }

  // ---------------------------------------------------------------- bắn

  /**
   * Ghi nhận một lượt bắn (click chuột trái).
   * @param hit id bia đã được raycast trúng, hoặc null nếu trượt.
   * @param offsetRatio khoảng cách điểm trúng tới tâm bia chia cho bán kính bia (0..1).
   * @returns true nếu trúng bia.
   */
  shoot(now: number, hit: { targetId: number; offsetRatio: number } | null): boolean {
    if (this.status !== "running") return false;
    // Đồng bộ đồng hồ trước khi xử lý để thời gian phản ứng/điểm chính xác tới thời điểm click.
    this.advance(now, false);
    if (this.status !== "running") return false;

    this.shots += 1;
    const target = hit ? this.targets.find((t) => t.id === hit.targetId) : undefined;

    if (!hit || !target) {
      if (this.mode === "REACTION" && this.targets.length === 0) {
        // Bắn khi bia chưa xuất hiện: false start, phạt thêm thời gian chờ.
        this.falseStarts += 1;
        this.nextSpawnAt = this.activeMs + this.randomDelay() + REACTION_PARAMS[this.difficulty].falseStartPenaltyMs;
        this.streak = 0;
        this.emit({ type: "miss", reason: "falseStart" });
        return false;
      }
      this.streak = 0;
      this.emit({ type: "miss", reason: "empty" });
      return false;
    }

    const offsetRatio = clampNumber(hit.offsetRatio, 0, 1);
    const timeToHitMs = this.activeMs - target.spawnAt;
    let points = 0;
    let reactionMs: number | null = null;
    let timeToHitOut: number | null = null;

    switch (this.mode) {
      case "FLICK": {
        const timeLeftRatio = target.expiresAt !== null ? (target.expiresAt - this.activeMs) / target.lifetimeMs : 0;
        points = flickPoints(timeLeftRatio, offsetRatio);
        this.timeToHitSumMs += timeToHitMs;
        this.timeToHitCount += 1;
        timeToHitOut = timeToHitMs;
        break;
      }
      case "PRECISION": {
        points = precisionPoints(offsetRatio);
        break;
      }
      case "REACTION": {
        reactionMs = timeToHitMs;
        points = reactionPoints(reactionMs);
        this.reactionSumMs += reactionMs;
        this.reactionCount += 1;
        this.lastReactionMs = reactionMs;
        this.bestReactionMs = this.bestReactionMs === null ? reactionMs : Math.min(this.bestReactionMs, reactionMs);
        break;
      }
      case "TRACKING": {
        // Tracking tính điểm theo thời gian bám; click trúng chỉ tính là một lượt trúng.
        points = 0;
        break;
      }
    }

    this.hits += 1;
    this.streak += 1;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    this.score += points;
    this.offsetSum += offsetRatio;
    this.offsetCount += 1;

    if (this.mode !== "TRACKING") {
      this.removeTarget(target.id);
      this.emit({
        type: "hit",
        targetId: target.id,
        points,
        reactionMs,
        timeToHitMs: timeToHitOut,
        offsetRatio,
        streak: this.streak,
      });
      this.onTargetResolved();
    } else {
      this.emit({
        type: "hit",
        targetId: target.id,
        points: 0,
        reactionMs: null,
        timeToHitMs: null,
        offsetRatio,
        streak: this.streak,
      });
    }
    return true;
  }

  // ---------------------------------------------------------------- truy vấn

  getStatus(): EngineStatus {
    return this.status;
  }

  getTargets(): TargetView[] {
    return this.targets.map(toView);
  }

  getTarget(id: number): TargetView | undefined {
    const t = this.targets.find((x) => x.id === id);
    return t ? toView(t) : undefined;
  }

  getTrackingTarget(): TargetView | null {
    return this.trackingTarget ? toView(this.trackingTarget) : null;
  }

  getSnapshot(): EngineSnapshot {
    const trackingPctValue = trackingPct(this.trackedMs, this.visibleMs);
    return {
      status: this.status,
      elapsedMs: Math.min(this.activeMs, this.durationMs),
      remainingMs: Math.max(0, this.durationMs - this.activeMs),
      durationMs: this.durationMs,
      score: this.currentScore(),
      shots: this.shots,
      hits: this.hits,
      misses: this.shots - this.hits,
      accuracy: accuracyPct(this.hits, this.shots),
      streak: this.streak,
      maxStreak: this.maxStreak,
      targetsSpawned: this.targetsSpawned,
      expired: this.expired,
      lastReactionMs: this.lastReactionMs,
      bestReactionMs: this.bestReactionMs,
      avgReactionMs: this.reactionCount > 0 ? round1(this.reactionSumMs / this.reactionCount) : null,
      avgTimeToHitMs: this.timeToHitCount > 0 ? round1(this.timeToHitSumMs / this.timeToHitCount) : null,
      trackingPct: trackingPctValue,
      precisionPct: this.offsetCount > 0 ? precisionPct(this.offsetSum / this.offsetCount) : null,
      falseStarts: this.falseStarts,
    };
  }

  /** Kết quả cuối cùng. Chỉ hợp lệ khi buổi tập đã kết thúc. */
  getResult(): SessionResult {
    if (this.status !== "finished") throw new Error("Buổi tập chưa kết thúc");
    const snap = this.getSnapshot();
    return {
      mode: this.mode,
      difficulty: this.difficulty,
      durationSec: this.durationSec,
      score: snap.score,
      shots: snap.shots,
      hits: snap.hits,
      misses: snap.misses,
      accuracy: snap.accuracy,
      maxStreak: snap.maxStreak,
      targetsSpawned: snap.targetsSpawned,
      avgReactionMs: this.mode === "REACTION" ? snap.avgReactionMs : null,
      bestReactionMs: this.mode === "REACTION" ? snap.bestReactionMs : null,
      avgTimeToHitMs: this.mode === "FLICK" ? snap.avgTimeToHitMs : null,
      trackingPct: this.mode === "TRACKING" ? snap.trackingPct : null,
      precisionPct: this.mode === "PRECISION" ? snap.precisionPct : null,
      expired: snap.expired,
      falseStarts: snap.falseStarts,
    };
  }

  // ---------------------------------------------------------------- nội bộ

  private currentScore(): number {
    if (this.mode === "TRACKING") return trackingPoints(this.trackedMs);
    return this.score;
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private advance(now: number, aimOnTarget: boolean): void {
    const dt = Math.max(0, now - this.lastNow);
    this.lastNow = now;
    const step = Math.min(dt, this.durationMs - this.activeMs);
    this.activeMs += step;

    if (this.mode === "TRACKING" && this.trackingTarget) {
      this.visibleMs += step;
      if (aimOnTarget) this.trackedMs += step;
      this.updateTrackingPosition();
    }

    // Bia hết hạn.
    for (const t of [...this.targets]) {
      if (t.expiresAt !== null && this.activeMs >= t.expiresAt) {
        this.removeTarget(t.id);
        this.expired += 1;
        this.emit({ type: "expire", targetId: t.id });
        this.onTargetResolved();
      }
    }

    if (this.activeMs >= this.durationMs) {
      this.complete();
      return;
    }

    this.trySpawn();
  }

  private complete(): void {
    if (this.status === "finished") return;
    this.status = "finished";
    this.targets = [];
    this.trackingTarget = null;
    this.emit({ type: "finish" });
  }

  private trySpawn(): void {
    if (this.mode === "TRACKING") return;
    const params = this.spawnParams();
    if (this.targets.length >= params.maxConcurrent || this.activeMs < this.nextSpawnAt) return;

    const radiusNdc = angularRadiusToNdc(params.radiusDeg, this.viewport.fovYDeg);
    const { u, v } = this.pickPosition(radiusNdc);
    const target: InternalTarget = {
      id: this.nextId++,
      kind: "static",
      u,
      v,
      radiusNdc,
      depthT: this.rng.next(),
      spawnAt: this.activeMs,
      expiresAt: params.lifetimeMs !== null ? this.activeMs + params.lifetimeMs : null,
      lifetimeMs: params.lifetimeMs ?? 0,
    };
    this.targets.push(target);
    this.lastSpawn = { u, v };
    this.targetsSpawned += 1;
    this.nextSpawnAt = Number.POSITIVE_INFINITY;
    this.emit({ type: "spawn", target: toView(target) });
  }

  private spawnParams(): { maxConcurrent: number; radiusDeg: number; lifetimeMs: number | null } {
    switch (this.mode) {
      case "FLICK": {
        const p = FLICK_PARAMS[this.difficulty];
        return { maxConcurrent: p.maxConcurrent, radiusDeg: p.radiusDeg, lifetimeMs: p.lifetimeMs };
      }
      case "PRECISION": {
        const p = PRECISION_PARAMS[this.difficulty];
        return { maxConcurrent: 1, radiusDeg: p.radiusDeg, lifetimeMs: p.lifetimeMs };
      }
      case "REACTION": {
        const p = REACTION_PARAMS[this.difficulty];
        return { maxConcurrent: 1, radiusDeg: p.radiusDeg, lifetimeMs: p.timeoutMs };
      }
      case "TRACKING":
        return { maxConcurrent: 0, radiusDeg: TRACKING_PARAMS[this.difficulty].radiusDeg, lifetimeMs: null };
    }
  }

  /** Gọi sau khi một bia bị bắn trúng hoặc hết hạn: lên lịch bia kế tiếp. */
  private onTargetResolved(): void {
    switch (this.mode) {
      case "FLICK":
        this.nextSpawnAt = this.activeMs + FLICK_PARAMS[this.difficulty].gapMs;
        break;
      case "PRECISION":
        this.nextSpawnAt = this.activeMs + PRECISION_PARAMS[this.difficulty].gapMs;
        break;
      case "REACTION":
        this.nextSpawnAt = this.activeMs + this.randomDelay();
        break;
      case "TRACKING":
        break;
    }
  }

  private removeTarget(id: number): void {
    this.targets = this.targets.filter((t) => t.id !== id);
  }

  private randomDelay(): number {
    const p = REACTION_PARAMS[this.difficulty];
    return Math.round(this.rng.range(p.minDelayMs, p.maxDelayMs));
  }

  private pickPosition(radiusNdc: number): { u: number; v: number } {
    const aspect = this.viewport.aspect;
    const rx = radiusNdc / aspect;
    const ry = radiusNdc;
    const uMax = 0.85 - rx;
    const vMax = 0.6 - ry;
    let fallback: { u: number; v: number } | null = null;

    for (let attempt = 0; attempt < 60; attempt++) {
      const u = this.rng.range(-uMax, uMax);
      const v = this.rng.range(-vMax, vMax);
      if (rectsOverlapCircle(this.exclusion, u, v, rx, ry)) continue;
      fallback ??= { u, v };
      if (this.lastSpawn) {
        const dx = (u - this.lastSpawn.u) * aspect;
        const dy = v - this.lastSpawn.v;
        if (Math.hypot(dx, dy) < MIN_SPAWN_SEPARATION) continue;
      }
      if (this.targets.some((t) => Math.hypot((u - t.u) * aspect, v - t.v) < radiusNdc * 3)) continue;
      return { u, v };
    }
    // Không tìm được vị trí đẹp: dùng vị trí ngoài vùng loại trừ đầu tiên, hoặc vị trí ngẫu nhiên.
    return fallback ?? { u: this.rng.range(-uMax, uMax), v: this.rng.range(-vMax, vMax) };
  }

  // ---------------------------------------------------------------- tracking

  private setupTracking(): void {
    const p = TRACKING_PARAMS[this.difficulty];
    const radiusNdc = angularRadiusToNdc(p.radiusDeg, this.viewport.fovYDeg);
    const rx = radiusNdc / this.viewport.aspect;
    const ry = radiusNdc;
    let center: [number, number] | null = null;
    for (const [cu, cv] of TRACK_CENTER_CANDIDATES) {
      const box: Rect = {
        x0: cu - TRACK_AMP_U - rx,
        x1: cu + TRACK_AMP_U + rx,
        y0: cv - TRACK_AMP_V - ry,
        y1: cv + TRACK_AMP_V + ry,
      };
      const onScreen = box.x0 > -0.95 && box.x1 < 0.95 && box.y0 > -0.9 && box.y1 < 0.9;
      const overlaps = this.exclusion.some(
        (e) => box.x0 < e.x1 && box.x1 > e.x0 && box.y0 < e.y1 && box.y1 > e.y0,
      );
      if (onScreen && !overlaps) {
        center = [cu, cv];
        break;
      }
    }
    // Nếu không có vị trí nào tránh được nhân vật thì dùng tâm (vẫn hiển thị đầy đủ bia).
    this.trackCenter = center ?? [0, 0.05];
    this.trackFreq = [this.rng.range(0.9, 1.4) * p.speed, this.rng.range(0.7, 1.1) * p.speed];
    this.trackPhase = [this.rng.range(0, Math.PI * 2), this.rng.range(0, Math.PI * 2)];

    const target: InternalTarget = {
      id: this.nextId++,
      kind: "tracking",
      u: this.trackCenter[0],
      v: this.trackCenter[1],
      radiusNdc,
      depthT: this.rng.next(),
      spawnAt: 0,
      expiresAt: null,
      lifetimeMs: 0,
    };
    this.trackingTarget = target;
    this.targets = [target];
    this.targetsSpawned = 1;
    this.updateTrackingPosition();
    this.emit({ type: "spawn", target: toView(target) });
  }

  private updateTrackingPosition(): void {
    const t = this.trackingTarget;
    if (!t) return;
    const s = this.activeMs / 1000;
    t.u = this.trackCenter[0] + TRACK_AMP_U * Math.sin(this.trackFreq[0] * s + this.trackPhase[0]);
    t.v = this.trackCenter[1] + TRACK_AMP_V * Math.sin(this.trackFreq[1] * s + this.trackPhase[1]);
  }
}

function toView(t: InternalTarget): TargetView {
  return {
    id: t.id,
    kind: t.kind,
    u: t.u,
    v: t.v,
    radiusNdc: t.radiusNdc,
    depthT: t.depthT,
    spawnAt: t.spawnAt,
    expiresAt: t.expiresAt,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
