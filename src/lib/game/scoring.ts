/**
 * Công thức tính điểm và các chỉ số. Hàm thuần, không có side effect.
 *
 * Giả định quan trọng (cũng được ghi trong README):
 * - Flick: mỗi lần bắn trúng tối đa 100 điểm. Bắn càng sớm (còn nhiều thời gian) và càng gần tâm càng nhiều điểm.
 * - Tracking: 100 điểm cho mỗi giây bám trúng bia (tối đa = 100 × thời lượng).
 * - Reaction: điểm = 1000 − thời gian phản ứng (ms), tối thiểu 0, tối đa 1000 cho mỗi lượt.
 * - Precision: 30..100 điểm tùy khoảng cách tới tâm bia (bán kính = 100%).
 * - Bắn trượt không bị trừ điểm nhưng vẫn được tính là một lượt bắn (shot) và làm ngắt chuỗi trúng.
 */

import type { TrainingMode } from "./config";

export const MAX_POINTS_FLICK_HIT = 100;
export const MAX_POINTS_PRECISION_HIT = 100;
export const MAX_POINTS_REACTION_HIT = 1000;
export const MAX_POINTS_TRACKING_PER_SECOND = 100;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Làm tròn tới 2 chữ số thập phân (dùng cho phần trăm, thời gian trung bình). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Điểm cho một phát bắn trúng trong chế độ Flick.
 * @param timeLeftRatio tỉ lệ thời gian còn lại của bia khi bị bắn trúng, 0..1
 * @param offsetRatio khoảng cách từ điểm trúng tới tâm bia chia cho bán kính bia, 0..1 (0 = tâm)
 */
export function flickPoints(timeLeftRatio: number, offsetRatio: number): number {
  const speed = clamp(0.5 + 0.5 * clamp(timeLeftRatio, 0, 1), 0.5, 1);
  const precision = clamp(1 - 0.5 * clamp(offsetRatio, 0, 1), 0.5, 1);
  return Math.round(MAX_POINTS_FLICK_HIT * speed * precision);
}

/** Điểm tracking: 100 điểm cho mỗi giây bám trúng (làm tròn xuống theo đơn vị 10ms). */
export function trackingPoints(trackedMs: number): number {
  return Math.floor(Math.max(0, trackedMs) / 10);
}

/** Điểm reaction: 1000 − thời gian phản ứng (ms), kẹp trong [0, 1000]. */
export function reactionPoints(reactionMs: number): number {
  return clamp(Math.round(MAX_POINTS_REACTION_HIT - reactionMs), 0, MAX_POINTS_REACTION_HIT);
}

/** Điểm precision: 100 ở tâm, 30 ở mép bia. */
export function precisionPoints(offsetRatio: number): number {
  return Math.round(100 * (1 - 0.7 * clamp(offsetRatio, 0, 1)));
}

/** Tỉ lệ chính xác (%) = trúng / lượt bắn. Không có lượt bắn thì trả về 0. */
export function accuracyPct(hits: number, shots: number): number {
  if (shots <= 0) return 0;
  return round2((clamp(hits, 0, shots) / shots) * 100);
}

/** Tỉ lệ thời gian bám trúng (%) = thời gian bám / thời gian bia tồn tại. */
export function trackingPct(trackedMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return round2(clamp(trackedMs / totalMs, 0, 1) * 100);
}

/** Tỉ lệ độ chính xác tâm (%) từ độ lệch trung bình (0 = tâm, 1 = mép). */
export function precisionPct(avgOffsetRatio: number): number {
  return round2((1 - clamp(avgOffsetRatio, 0, 1)) * 100);
}

/**
 * Điểm tối đa có thể đạt được với số lần trúng và thời lượng cho trước.
 * Server dùng hàm này để loại bỏ điểm số bất khả thi do client gửi lên.
 */
export function maxPossibleScore(mode: TrainingMode, durationSec: number, hits: number): number {
  switch (mode) {
    case "FLICK":
      return MAX_POINTS_FLICK_HIT * hits;
    case "PRECISION":
      return MAX_POINTS_PRECISION_HIT * hits;
    case "REACTION":
      return MAX_POINTS_REACTION_HIT * hits;
    case "TRACKING":
      return MAX_POINTS_TRACKING_PER_SECOND * durationSec;
  }
}
