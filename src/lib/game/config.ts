/**
 * Cấu hình chung cho các chế độ luyện tập: thời lượng, độ khó, tham số từng chế độ.
 * File này thuần TypeScript (không phụ thuộc React/Three) để có thể kiểm thử bằng Vitest.
 */

export const TRAINING_MODES = ["FLICK", "TRACKING", "REACTION", "PRECISION"] as const;
export type TrainingMode = (typeof TRAINING_MODES)[number];

export const DIFFICULTIES = ["EASY", "NORMAL", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DURATIONS_SEC = [30, 60, 120] as const;
export type DurationSec = (typeof DURATIONS_SEC)[number];

/** Giới hạn số lần bắn hợp lý trong một giây (dùng để phát hiện dữ liệu bất thường phía server). */
export const MAX_CLICKS_PER_SECOND = 20;

export const MODE_INFO: Record<
  TrainingMode,
  { label: string; description: string; metric: string }
> = {
  FLICK: {
    label: "Flick",
    description: "Bia xuất hiện ở vị trí ngẫu nhiên. Bắn nhanh và chính xác để đạt điểm cao hơn.",
    metric: "Thời gian trung bình bắn trúng",
  },
  TRACKING: {
    label: "Tracking",
    description: "Bia di chuyển liên tục. Giữ tâm ngắm trên bia càng lâu càng tốt.",
    metric: "Tỷ lệ thời gian bám trúng",
  },
  REACTION: {
    label: "Reaction",
    description: "Bia xuất hiện sau một khoảng chờ ngẫu nhiên. Bắn ngay khi bia hiện ra.",
    metric: "Thời gian phản ứng",
  },
  PRECISION: {
    label: "Precision",
    description: "Bia nhỏ, xuất hiện theo lượt. Nhắm vào giữa bia để đạt độ chính xác cao.",
    metric: "Độ chính xác tâm bia",
  },
};

export const DIFFICULTY_INFO: Record<Difficulty, { label: string }> = {
  EASY: { label: "Dễ" },
  NORMAL: { label: "Thường" },
  HARD: { label: "Khó" },
};

/** Tham số theo độ khó. Góc (độ) là bán kính góc nhìn của bia, không phụ thuộc khoảng cách. */
export interface FlickParams {
  lifetimeMs: number;
  radiusDeg: number;
  maxConcurrent: number;
  gapMs: number;
}
export interface TrackingParams {
  radiusDeg: number;
  speed: number;
}
export interface ReactionParams {
  minDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  falseStartPenaltyMs: number;
  radiusDeg: number;
}
export interface PrecisionParams {
  radiusDeg: number;
  lifetimeMs: number;
  gapMs: number;
}

export const FLICK_PARAMS: Record<Difficulty, FlickParams> = {
  EASY: { lifetimeMs: 2200, radiusDeg: 2.4, maxConcurrent: 1, gapMs: 250 },
  NORMAL: { lifetimeMs: 1500, radiusDeg: 1.9, maxConcurrent: 1, gapMs: 180 },
  HARD: { lifetimeMs: 1000, radiusDeg: 1.5, maxConcurrent: 2, gapMs: 120 },
};

export const TRACKING_PARAMS: Record<Difficulty, TrackingParams> = {
  EASY: { radiusDeg: 2.3, speed: 0.6 },
  NORMAL: { radiusDeg: 1.8, speed: 1.0 },
  HARD: { radiusDeg: 1.35, speed: 1.5 },
};

export const REACTION_PARAMS: Record<Difficulty, ReactionParams> = {
  EASY: { minDelayMs: 1500, maxDelayMs: 3500, timeoutMs: 3000, falseStartPenaltyMs: 600, radiusDeg: 2.2 },
  NORMAL: { minDelayMs: 1000, maxDelayMs: 3000, timeoutMs: 2500, falseStartPenaltyMs: 800, radiusDeg: 1.8 },
  HARD: { minDelayMs: 800, maxDelayMs: 2200, timeoutMs: 2000, falseStartPenaltyMs: 1000, radiusDeg: 1.4 },
};

export const PRECISION_PARAMS: Record<Difficulty, PrecisionParams> = {
  EASY: { radiusDeg: 0.75, lifetimeMs: 3500, gapMs: 300 },
  NORMAL: { radiusDeg: 0.5, lifetimeMs: 2600, gapMs: 250 },
  HARD: { radiusDeg: 0.35, lifetimeMs: 1800, gapMs: 200 },
};

export function isTrainingMode(value: string): value is TrainingMode {
  return (TRAINING_MODES as readonly string[]).includes(value);
}

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

export function isDurationSec(value: number): value is DurationSec {
  return (DURATIONS_SEC as readonly number[]).includes(value);
}
