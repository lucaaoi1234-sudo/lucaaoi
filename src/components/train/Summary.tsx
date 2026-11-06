"use client";

import Link from "next/link";
import type { SessionResult } from "@/lib/game/engine";
import { DIFFICULTY_INFO, MODE_INFO } from "@/lib/game/config";
import { Alert, Button, Card, formatMs, formatNumber, formatPct, StatTile } from "../ui";
import { ModeBadge } from "../ModeBadge";

export type SaveState =
  | { status: "saving" }
  | { status: "server" }
  | { status: "local" }
  | { status: "error"; message: string };

export function Summary({
  result,
  save,
  onRetry,
  onReplay,
  onMenu,
}: {
  result: SessionResult;
  save: SaveState;
  onRetry: () => void;
  onReplay: () => void;
  onMenu: () => void;
}) {
  const mode = result.mode;
  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden p-6 text-center sm:p-10">
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-96 -translate-x-1/2 rounded-full bg-neon-2/15 blur-3xl" />
        <p className="text-xs uppercase tracking-[0.3em] text-neon/80">Kết thúc buổi tập</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <ModeBadge mode={mode} />
          <span className="text-sm text-slate-400">
            {result.durationSec} giây · {DIFFICULTY_INFO[result.difficulty].label}
          </span>
        </div>
        <p className="mt-4 text-6xl font-black tabular-nums text-white sm:text-7xl">{formatNumber(result.score)}</p>
        <p className="mt-2 text-sm text-slate-400">Tổng điểm</p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Độ chính xác" value={formatPct(result.accuracy)} tone="lime" />
        <StatTile label="Trúng" value={formatNumber(result.hits)} hint={`trên ${formatNumber(result.shots)} lượt bắn`} />
        <StatTile label="Trượt" value={formatNumber(result.misses)} tone="warn" />
        <StatTile label="Chuỗi trúng tốt nhất" value={formatNumber(result.maxStreak)} tone="magenta" />
      </div>

      <Card title={`Chỉ số · ${MODE_INFO[mode].label}`} subtitle={MODE_INFO[mode].metric}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {mode === "FLICK" && (
            <>
              <StatTile label="TB thời gian bắn trúng" value={formatMs(result.avgTimeToHitMs)} />
              <StatTile label="Bia đã bỏ lỡ" value={formatNumber(result.expired)} tone="warn" />
              <StatTile label="Bia đã xuất hiện" value={formatNumber(result.targetsSpawned)} />
            </>
          )}
          {mode === "TRACKING" && (
            <>
              <StatTile label="Tỉ lệ bám trúng" value={formatPct(result.trackingPct)} tone="lime" />
              <StatTile label="Điểm bám" value={formatNumber(result.score)} hint="100 điểm mỗi giây bám" />
            </>
          )}
          {mode === "REACTION" && (
            <>
              <StatTile label="Phản ứng trung bình" value={formatMs(result.avgReactionMs)} />
              <StatTile label="Phản ứng nhanh nhất" value={formatMs(result.bestReactionMs)} tone="lime" />
              <StatTile label="Bắn sớm" value={formatNumber(result.falseStarts)} tone="warn" hint="bắn trước khi bia xuất hiện" />
              <StatTile label="Lượt phản ứng" value={formatNumber(result.targetsSpawned)} />
            </>
          )}
          {mode === "PRECISION" && (
            <>
              <StatTile label="Chính xác tâm" value={formatPct(result.precisionPct)} tone="lime" />
              <StatTile label="Bia đã bỏ lỡ" value={formatNumber(result.expired)} tone="warn" />
              <StatTile label="Lượt bia" value={formatNumber(result.targetsSpawned)} />
            </>
          )}
        </div>
      </Card>

      <Card title="Lưu kết quả">
        {save.status === "saving" && <p className="text-sm text-slate-400">Đang lưu buổi tập…</p>}
        {save.status === "server" && <Alert tone="success">Đã lưu vào tài khoản của bạn trên máy chủ.</Alert>}
        {save.status === "local" && (
          <Alert tone="info">
            Đã lưu trên trình duyệt này (chế độ khách).{" "}
            <Link href="/register" className="underline">
              Đăng ký
            </Link>{" "}
            để lưu lâu dài.
          </Alert>
        )}
        {save.status === "error" && (
          <div className="space-y-3">
            <Alert>Không lưu được buổi tập: {save.message}</Alert>
            <Button onClick={onRetry}>Thử lưu lại</Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={onReplay}>
          ↻ Chơi lại
        </Button>
        <Button onClick={onMenu}>Đổi chế độ</Button>
        <Link href="/stats" className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">
          Xem thống kê →
        </Link>
      </div>
    </div>
  );
}
