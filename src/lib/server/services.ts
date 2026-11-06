import "server-only";
import { Prisma, type TrainingSession as DbSession } from "@prisma/client";
import { getDb } from "./db";
import type { SessionRecord } from "../stats/aggregate";
import { aggregateSessions, type StatsSummary } from "../stats/aggregate";
import type { TrainingMode } from "../game/config";
import { accuracyPct } from "../game/scoring";
import type { SessionSubmitInput, SettingsInput } from "../validation/schemas";

/** Dữ liệu buổi tập trả về cho client (đã chuẩn hoá tên trường). */
export interface SessionDTO extends SessionRecord {
  id: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  accuracy: number;
  maxStreak: number;
  durationSec: number;
  difficulty: SessionRecord["difficulty"];
  createdAt: string;
}

const STATS_SESSION_CAP = 5000;

function toDto(row: DbSession): SessionDTO {
  return {
    id: row.id,
    mode: row.mode,
    difficulty: row.difficulty,
    durationSec: row.durationSec,
    score: row.score,
    shots: row.shots,
    hits: row.hits,
    misses: row.misses,
    accuracy: row.accuracy,
    maxStreak: row.maxStreak,
    avgReactionMs: row.avgReactionMs,
    bestReactionMs: row.bestReactionMs,
    avgTimeToHitMs: row.avgTimeToHitMs,
    trackingPct: row.trackingPct,
    precisionPct: row.precisionPct,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lưu một buổi tập đã được kiểm tra bằng Zod.
 * Server tự tính `misses`, `accuracy` và chỉ giữ các chỉ số thuộc đúng chế độ chơi.
 */
export async function createTrainingSession(userId: string, input: SessionSubmitInput): Promise<SessionDTO> {
  const mode: TrainingMode = input.mode;
  const row = await getDb().trainingSession.create({
    data: {
      userId,
      mode,
      difficulty: input.difficulty,
      durationSec: input.durationSec,
      score: input.score,
      shots: input.shots,
      hits: input.hits,
      misses: input.shots - input.hits,
      accuracy: accuracyPct(input.hits, input.shots),
      maxStreak: input.maxStreak,
      targetsSpawned: input.targetsSpawned,
      avgReactionMs: mode === "REACTION" ? input.avgReactionMs : null,
      bestReactionMs: mode === "REACTION" ? input.bestReactionMs : null,
      avgTimeToHitMs: mode === "FLICK" ? input.avgTimeToHitMs : null,
      trackingPct: mode === "TRACKING" ? input.trackingPct : null,
      precisionPct: mode === "PRECISION" ? input.precisionPct : null,
    },
  });
  return toDto(row);
}

export async function listTrainingSessions(userId: string, limit: number): Promise<SessionDTO[]> {
  const rows = await getDb().trainingSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toDto);
}

export async function getPersonalStats(userId: string): Promise<{ summary: StatsSummary; recent: SessionDTO[] }> {
  const rows = await getDb().trainingSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: STATS_SESSION_CAP,
  });
  const dtos = rows.map(toDto);
  return {
    summary: aggregateSessions(dtos),
    recent: dtos.slice(0, 10),
  };
}

/**
 * Bảng xếp hạng: mỗi người chơi chỉ xuất hiện một lần với buổi có điểm cao nhất
 * (trong cùng chế độ và thời lượng nếu có lọc). Chỉ gồm người dùng đã đăng nhập.
 */
export async function getLeaderboard(
  mode: TrainingMode,
  durationSec: number | null,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const durationFilter = durationSec === null ? Prisma.empty : Prisma.sql`AND s."durationSec" = ${durationSec}`;
  const rows = await getDb().$queryRaw<
    {
      displayName: string;
      score: number;
      accuracy: number;
      maxStreak: number;
      durationSec: number;
      difficulty: SessionRecord["difficulty"];
      createdAt: Date;
    }[]
  >(Prisma.sql`
    SELECT * FROM (
      SELECT DISTINCT ON (s."userId")
        u."displayName" AS "displayName",
        s."score" AS "score",
        s."accuracy" AS "accuracy",
        s."maxStreak" AS "maxStreak",
        s."durationSec" AS "durationSec",
        s."difficulty"::text AS "difficulty",
        s."createdAt" AS "createdAt"
      FROM "TrainingSession" s
      JOIN "User" u ON u."id" = s."userId"
      WHERE s."mode" = ${mode}::"TrainingMode" ${durationFilter}
      ORDER BY s."userId", s."score" DESC, s."createdAt" ASC
    ) best
    ORDER BY best."score" DESC, best."createdAt" ASC
    LIMIT ${limit}
  `);

  return rows.map((r, index) => ({
    rank: index + 1,
    displayName: r.displayName,
    score: r.score,
    accuracy: r.accuracy,
    maxStreak: r.maxStreak,
    durationSec: r.durationSec,
    difficulty: r.difficulty,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getOrCreateSettings(userId: string, defaults: SettingsInput): Promise<SettingsInput> {
  const row = await getDb().userSettings.upsert({
    where: { userId },
    create: { userId, ...defaults },
    update: {},
  });
  return toSettingsDto(row);
}

export async function updateSettings(userId: string, input: SettingsInput): Promise<SettingsInput> {
  const row = await getDb().userSettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  });
  return toSettingsDto(row);
}

function toSettingsDto(row: {
  sensitivity: number;
  crosshairSize: number;
  crosshairColor: string;
  volume: number;
  fov: number;
  graphicsQuality: "LOW" | "MEDIUM" | "HIGH";
}): SettingsInput {
  return {
    sensitivity: row.sensitivity,
    crosshairSize: row.crosshairSize,
    crosshairColor: row.crosshairColor,
    volume: row.volume,
    fov: row.fov,
    graphicsQuality: row.graphicsQuality,
  };
}
