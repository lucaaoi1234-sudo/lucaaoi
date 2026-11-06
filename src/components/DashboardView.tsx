"use client";

import { useAuth } from "@/lib/client/auth-context";
import { useStats } from "@/lib/client/data";
import { DIFFICULTY_INFO, MODE_INFO, TRAINING_MODES } from "@/lib/game/config";
import { Alert, ButtonLink, Card, EmptyState, formatDate, formatNumber, formatPct, Spinner, StatTile } from "./ui";
import { ModeBadge } from "./ModeBadge";

export function DashboardView() {
  const { user } = useAuth();
  const { summary, recent, status, error, isGuest } = useStats();

  return (
    <>
      <section className="glass relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-neon/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-neon-2/10 blur-3xl" />
        <p className="text-xs uppercase tracking-[0.3em] text-neon/80">Phòng tập sci-fi</p>
        <h1 className="neon-text mt-2 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          {user ? `Sẵn sàng, ${user.displayName}?` : "Sẵn sàng luyện aim?"}
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Bắn bia hologram bằng chuột, theo dõi độ chính xác và chuỗi trúng của bạn qua từng buổi. Có thể chơi ngay không
          cần đăng nhập.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/train?mode=FLICK&duration=60&difficulty=NORMAL" variant="primary" className="px-6 py-3 text-base">
            ▶ Bắt đầu nhanh · Flick 60s
          </ButtonLink>
          <ButtonLink href="/stats" variant="secondary" className="px-5 py-3">
            Xem thống kê
          </ButtonLink>
        </div>
        {isGuest && (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Bạn đang ở chế độ khách: lịch sử chỉ lưu trên trình duyệt này. Hãy{" "}
            <a href="/register" className="font-semibold underline">
              đăng ký tài khoản
            </a>{" "}
            để lưu lâu dài và tham gia bảng xếp hạng.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Chọn chế độ</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TRAINING_MODES.map((mode) => (
            <a
              key={mode}
              href={`/train?mode=${mode}`}
              className="glass group block p-5 transition hover:-translate-y-0.5 hover:border-neon/40"
            >
              <div className="flex items-center justify-between">
                <ModeBadge mode={mode} />
                <span className="text-slate-500 transition group-hover:text-neon">→</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{MODE_INFO[mode].label}</h3>
              <p className="mt-2 text-sm text-slate-400">{MODE_INFO[mode].description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card title="Tổng quan" subtitle={isGuest ? "Dữ liệu từ trình duyệt này" : "Dữ liệu tài khoản của bạn"} className="lg:col-span-2">
          {status === "loading" && <Spinner />}
          {status === "error" && <Alert>{error}</Alert>}
          {status === "ready" && summary && summary.totalSessions === 0 && (
            <EmptyState
              title="Chưa có buổi tập nào"
              description="Hoàn thành buổi tập đầu tiên để thấy điểm, độ chính xác và xu hướng của bạn tại đây."
              action={<ButtonLink href="/train" variant="primary">Vào phòng tập</ButtonLink>}
            />
          )}
          {status === "ready" && summary && summary.totalSessions > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Buổi tập" value={formatNumber(summary.totalSessions)} />
              <StatTile label="Điểm cao nhất" value={formatNumber(summary.bestScore)} tone="magenta" />
              <StatTile label="Độ chính xác" value={formatPct(summary.overallAccuracy)} tone="lime" />
              <StatTile label="Chuỗi trúng dài nhất" value={formatNumber(summary.bestStreak)} tone="warn" />
            </div>
          )}
        </Card>

        <Card title="Gần đây" subtitle="10 buổi tập gần nhất">
          {status === "loading" && <Spinner />}
          {status === "ready" && recent.length === 0 && (
            <p className="text-sm text-slate-400">Chưa có dữ liệu. Bắt đầu một buổi tập để xem tại đây.</p>
          )}
          <ul className="divide-y divide-white/5">
            {recent.slice(0, 6).map((s) => (
              <li key={s.createdAt + s.mode + s.score} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <ModeBadge mode={s.mode} compact />
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(s.createdAt)} · {s.durationSec}s · {DIFFICULTY_INFO[s.difficulty].label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-white">{formatNumber(s.score)}</p>
                  <p className="text-xs tabular-nums text-slate-400">{formatPct(s.accuracy)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </>
  );
}
