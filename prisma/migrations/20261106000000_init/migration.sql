-- AimForge initial schema (PostgreSQL)
-- Tương đương với output của `prisma migrate dev --name init` theo schema.prisma.

-- CreateEnum
CREATE TYPE "TrainingMode" AS ENUM ('FLICK', 'TRACKING', 'REACTION', 'PRECISION');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "GraphicsQuality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "displayName" VARCHAR(24) NOT NULL,
    "passwordHash" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "TrainingMode" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "hits" INTEGER NOT NULL,
    "misses" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "maxStreak" INTEGER NOT NULL,
    "targetsSpawned" INTEGER NOT NULL,
    "avgReactionMs" DOUBLE PRECISION,
    "bestReactionMs" INTEGER,
    "avgTimeToHitMs" DOUBLE PRECISION,
    "trackingPct" DOUBLE PRECISION,
    "precisionPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id"),
    -- Ràng buộc phòng thủ chiều sâu: không cho phép giá trị vô lý dù code tầng ứng dụng đã kiểm tra.
    CONSTRAINT "TrainingSession_ranges_check" CHECK (
        "durationSec" IN (30, 60, 120)
        AND "score" >= 0
        AND "shots" >= 0
        AND "hits" >= 0
        AND "misses" >= 0
        AND "hits" + "misses" = "shots"
        AND "accuracy" >= 0 AND "accuracy" <= 100
        AND "maxStreak" >= 0 AND "maxStreak" <= "hits"
        AND "targetsSpawned" >= 0
        AND ("trackingPct" IS NULL OR ("trackingPct" >= 0 AND "trackingPct" <= 100))
        AND ("precisionPct" IS NULL OR ("precisionPct" >= 0 AND "precisionPct" <= 100))
    )
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sensitivity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "crosshairSize" INTEGER NOT NULL DEFAULT 14,
    "crosshairColor" VARCHAR(7) NOT NULL DEFAULT '#7ff7ff',
    "volume" INTEGER NOT NULL DEFAULT 60,
    "fov" INTEGER NOT NULL DEFAULT 70,
    "graphicsQuality" "GraphicsQuality" NOT NULL DEFAULT 'MEDIUM',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserSettings_ranges_check" CHECK (
        "sensitivity" > 0 AND "sensitivity" <= 5
        AND "crosshairSize" BETWEEN 4 AND 40
        AND "volume" BETWEEN 0 AND 100
        AND "fov" BETWEEN 50 AND 100
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_createdAt_idx" ON "TrainingSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingSession_mode_durationSec_score_idx" ON "TrainingSession"("mode", "durationSec", "score");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
