/**
 * Tổng hợp thống kê từ danh sách buổi tập. Hàm thuần, dùng chung cho:
 * - thống kê của tài khoản (server tổng hợp từ PostgreSQL),
 * - thống kê của khách (tổng hợp từ localStorage trên trình duyệt).
 *
 * Giả định: accuracy/trackingPct/precisionPct là phần trăm (0..100); reaction/time-to-hit là mili-giây.
 */

import { TRAINING_MODES, type TrainingMode } from "../game/config";
import { accuracyPct, round2 } from "../game/scoring";

export interface SessionRecord {
  mode: TrainingMode;
  difficulty: "EASY" | "NORMAL" | "HARD";
  durationSec: number;
  score: number;
  shots: number;
  hits: number;
  misses: number;
  accuracy: number;
  maxStreak: number;
  avgReactionMs: number | null;
  bestReactionMs: number | null;
  avgTimeToHitMs: number | null;
  trackingPct: number | null;
  precisionPct: number | null;
  /** ISO 8601 */
  createdAt: string;
}

export interface ModeStats {
  mode: TrainingMode;
  sessions: number;
  bestScore: number;
  avgScore: number;
  accuracy: number;
  bestStreak: number;
  bestReactionMs: number | null;
  avgReactionMs: number | null;
  avgTimeToHitMs: number | null;
  avgTrackingPct: number | null;
  avgPrecisionPct: number | null;
}

export interface TrendPoint {
  createdAt: string;
  mode: TrainingMode;
  score: number;
  accuracy: number;
}

export interface StatsSummary {
  totalSessions: number;
  totalPlayTimeSec: number;
  totalShots: number;
  totalHits: number;
  totalMisses: number;
  overallAccuracy: number;
  bestScore: number;
  bestStreak: number;
  lastPlayedAt: string | null;
  byMode: Record<TrainingMode, ModeStats>;
  /** Tối đa 30 buổi gần nhất, cũ → mới. */
  trend: TrendPoint[];
}

export const TREND_LIMIT = 30;

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function minOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

function emptyModeStats(mode: TrainingMode): ModeStats {
  return {
    mode,
    sessions: 0,
    bestScore: 0,
    avgScore: 0,
    accuracy: 0,
    bestStreak: 0,
    bestReactionMs: null,
    avgReactionMs: null,
    avgTimeToHitMs: null,
    avgTrackingPct: null,
    avgPrecisionPct: null,
  };
}

export function aggregateSessions(sessions: readonly SessionRecord[]): StatsSummary {
  const byMode = Object.fromEntries(TRAINING_MODES.map((m) => [m, emptyModeStats(m)])) as Record<
    TrainingMode,
    ModeStats
  >;

  let totalPlayTimeSec = 0;
  let totalShots = 0;
  let totalHits = 0;
  let bestScore = 0;
  let bestStreak = 0;
  let lastPlayedAt: string | null = null;

  for (const mode of TRAINING_MODES) {
    const list = sessions.filter((s) => s.mode === mode);
    if (list.length === 0) continue;
    const shots = list.reduce((sum, s) => sum + s.shots, 0);
    const hits = list.reduce((sum, s) => sum + s.hits, 0);
    const reactions = list.map((s) => s.avgReactionMs).filter((v): v is number => v !== null);
    const bestReactions = list.map((s) => s.bestReactionMs).filter((v): v is number => v !== null);
    const tth = list.map((s) => s.avgTimeToHitMs).filter((v): v is number => v !== null);
    const tracking = list.map((s) => s.trackingPct).filter((v): v is number => v !== null);
    const precision = list.map((s) => s.precisionPct).filter((v): v is number => v !== null);

    byMode[mode] = {
      mode,
      sessions: list.length,
      bestScore: Math.max(...list.map((s) => s.score)),
      avgScore: Math.round(list.reduce((sum, s) => sum + s.score, 0) / list.length),
      accuracy: accuracyPct(hits, shots),
      bestStreak: Math.max(...list.map((s) => s.maxStreak)),
      bestReactionMs: minOrNull(bestReactions),
      avgReactionMs: average(reactions),
      avgTimeToHitMs: average(tth),
      avgTrackingPct: average(tracking),
      avgPrecisionPct: average(precision),
    };
  }

  for (const s of sessions) {
    totalPlayTimeSec += s.durationSec;
    totalShots += s.shots;
    totalHits += s.hits;
    bestScore = Math.max(bestScore, s.score);
    bestStreak = Math.max(bestStreak, s.maxStreak);
    if (lastPlayedAt === null || s.createdAt > lastPlayedAt) lastPlayedAt = s.createdAt;
  }

  const ordered = [...sessions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const trend = ordered.slice(-TREND_LIMIT).map((s) => ({
    createdAt: s.createdAt,
    mode: s.mode,
    score: s.score,
    accuracy: s.accuracy,
  }));

  return {
    totalSessions: sessions.length,
    totalPlayTimeSec,
    totalShots,
    totalHits,
    totalMisses: totalShots - totalHits,
    overallAccuracy: accuracyPct(totalHits, totalShots),
    bestScore,
    bestStreak,
    lastPlayedAt,
    byMode,
    trend,
  };
}
