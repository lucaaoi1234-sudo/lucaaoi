import type { SessionRecord } from "../stats/aggregate";
import type { SessionResult } from "./engine";

/** Payload gửi lên `POST /api/sessions`. Không chứa userId, misses hay accuracy (server tự tính). */
export interface SessionSubmitPayload {
  mode: SessionResult["mode"];
  difficulty: SessionResult["difficulty"];
  durationSec: number;
  score: number;
  shots: number;
  hits: number;
  maxStreak: number;
  targetsSpawned: number;
  expired: number;
  falseStarts: number;
  avgReactionMs: number | null;
  bestReactionMs: number | null;
  avgTimeToHitMs: number | null;
  trackingPct: number | null;
  precisionPct: number | null;
}

export function toSubmitPayload(result: SessionResult): SessionSubmitPayload {
  return {
    mode: result.mode,
    difficulty: result.difficulty,
    durationSec: result.durationSec,
    score: result.score,
    shots: result.shots,
    hits: result.hits,
    maxStreak: result.maxStreak,
    targetsSpawned: result.targetsSpawned,
    expired: result.expired,
    falseStarts: result.falseStarts,
    avgReactionMs: result.avgReactionMs,
    bestReactionMs: result.bestReactionMs,
    avgTimeToHitMs: result.avgTimeToHitMs,
    trackingPct: result.trackingPct,
    precisionPct: result.precisionPct,
  };
}

/** Bản ghi buổi tập cho lịch sử khách (localStorage). */
export function toLocalRecord(result: SessionResult, id: string, createdAt: string): SessionRecord & { id: string } {
  return {
    id,
    mode: result.mode,
    difficulty: result.difficulty,
    durationSec: result.durationSec,
    score: result.score,
    shots: result.shots,
    hits: result.hits,
    misses: result.misses,
    accuracy: result.accuracy,
    maxStreak: result.maxStreak,
    avgReactionMs: result.avgReactionMs,
    bestReactionMs: result.bestReactionMs,
    avgTimeToHitMs: result.avgTimeToHitMs,
    trackingPct: result.trackingPct,
    precisionPct: result.precisionPct,
    createdAt,
  };
}
