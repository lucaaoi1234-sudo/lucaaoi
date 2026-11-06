"use client";

import { useAuth } from "@/lib/client/auth-context";
import { useStats } from "@/lib/client/data";
import { DIFFICULTY_INFO, MODE_INFO, TRAINING_MODES, type TrainingMode } from "@/lib/game/config";
import type { ModeStats } from "@/lib/stats/aggregate";
import { Alert, ButtonLink, Card, EmptyState, formatDate, formatMs, formatNumber, formatPct, PageHeader, Spinner, StatTile } from "./ui";
import { ModeBadge } from "./ModeBadge";

export function StatsView() {
  const { user } = useAuth();
  const { summary, recent, status, error, isGuest } = useStats();

  return (
    <>
      <PageHeader
        eyebrow="Hồ sơ"
        title="Thống kê cá nhân"
        description={
          isGuest
            ? "Bạn đang xem thống kê của khách, dữ liệu lưu trong trình duyệt này. Đăng nhập để đồng bộ lên máy chủ."
            : `Thống kê của ${user?.displayName ?? "bạn"}, lưu trên máy chủ.`
        }
      />

      {status === "loading" && <Spinner />}
      {status === "error" && <Alert>{error}</Alert>}

      {status === "ready" && summary && summary.totalSessions === 0 && (
        <EmptyState
          title="Chưa có dữ liệu thống kê"
          description="Thống kê sẽ xuất hiện sau khi bạn hoàn thành ít nhất một buổi tập."
          action={<ButtonLink href="/train" variant="primary">Bắt đầu luyện tập</ButtonLink>}
        />
      )}

      {status === "ready" && summary && summary.totalSessions > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Buổi tập" value={formatNumber(summary.totalSessions)} />
            <StatTile label="Tổng thời gian" value={formatNumber(Math.round(summary.totalPlayTimeSec / 60))} hint="phút" />
            <StatTile label="Lượt bắn" value={formatNumber(summary.totalShots)} />
            <StatTile label="Lượt trúng" value={formatNumber(summary.totalHits)} tone="lime" />
            <StatTile label="Độ chính xác" value={formatPct(summary.overallAccuracy)} tone="lime" />
            <StatTile label="Chuỗi trúng tốt nhất" value={formatNumber(summary.bestStreak)} tone="warn" />
          </div>

          <Card title="Xu hướng điểm số" subtitle={`Tối đa 30 buổi gần nhất · Điểm cao nhất ${formatNumber(summary.bestScore)}`}>
            <TrendChart points={summary.trend} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {TRAINING_MODES.map((mode) => (
              <ModeCard key={mode} mode={mode} stats={summary.byMode[mode]} />
            ))}
          </div>

          <Card title="Lịch sử gần đây" subtitle="10 buổi tập gần nhất">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Thời gian</th>
                    <th className="py-2 pr-3 font-medium">Chế độ</th>
                    <th className="py-2 pr-3 font-medium">Thời lượng</th>
                    <th className="py-2 pr-3 font-medium">Độ khó</th>
                    <th className="py-2 pr-3 text-right font-medium">Điểm</th>
                    <th className="py-2 pr-3 text-right font-medium">Trúng / Bắn</th>
                    <th className="py-2 text-right font-medium">Chính xác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent.map((s) => (
                    <tr key={s.createdAt + s.mode + s.score} className="text-slate-200">
                      <td className="py-2.5 pr-3 text-slate-400">{formatDate(s.createdAt)}</td>
                      <td className="py-2.5 pr-3">
                        <ModeBadge mode={s.mode} compact />
                      </td>
                      <td className="py-2.5 pr-3">{s.durationSec}s</td>
                      <td className="py-2.5 pr-3">{DIFFICULTY_INFO[s.difficulty].label}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-white">{formatNumber(s.score)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {s.hits} / {s.shots}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{formatPct(s.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function ModeCard({ mode, stats }: { mode: TrainingMode; stats: ModeStats }) {
  const info = MODE_INFO[mode];
  const hasData = stats.sessions > 0;
  return (
    <Card
      title={info.label}
      subtitle={hasData ? `${stats.sessions} buổi · ${info.metric}` : "Chưa có buổi tập nào ở chế độ này"}
      actions={<ModeBadge mode={mode} compact />}
    >
      {hasData ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Metric label="Điểm cao nhất" value={formatNumber(stats.bestScore)} />
          <Metric label="Điểm trung bình" value={formatNumber(stats.avgScore)} />
          <Metric label="Độ chính xác" value={formatPct(stats.accuracy)} />
          <Metric label="Chuỗi trúng tốt nhất" value={formatNumber(stats.bestStreak)} />
          {mode === "REACTION" && <Metric label="Phản ứng TB" value={formatMs(stats.avgReactionMs)} />}
          {mode === "REACTION" && <Metric label="Phản ứng nhanh nhất" value={formatMs(stats.bestReactionMs)} />}
          {mode === "FLICK" && <Metric label="Thời gian bắn trúng TB" value={formatMs(stats.avgTimeToHitMs)} />}
          {mode === "TRACKING" && <Metric label="Bám trúng TB" value={formatPct(stats.avgTrackingPct)} />}
          {mode === "PRECISION" && <Metric label="Chính xác tâm TB" value={formatPct(stats.avgPrecisionPct)} />}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">Hãy thử chế độ này để xem chỉ số riêng.</p>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}

/** Biểu đồ đường SVG đơn giản (không cần thư viện). */
function TrendChart({ points }: { points: { createdAt: string; score: number; mode: TrainingMode; accuracy: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-slate-400">Cần ít nhất 2 buổi tập để vẽ xu hướng.</p>;
  }
  const width = 800;
  const height = 220;
  const pad = 24;
  const max = Math.max(1, ...points.map((p) => p.score));
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: pad + i * step,
    y: height - pad - (p.score / max) * (height - pad * 2),
    p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1]?.x.toFixed(1)},${height - pad} L${pad},${height - pad} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full min-w-[480px]" role="img" aria-label="Biểu đồ điểm số theo buổi tập">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={width - pad} y1={height - pad - f * (height - pad * 2)} y2={height - pad - f * (height - pad * 2)} stroke="rgba(148,163,184,0.12)" />
        ))}
        <path d={area} fill="url(#trend-fill)" />
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="#e879f9">
            <title>{`${formatDate(c.p.createdAt)} · ${MODE_INFO[c.p.mode].label} · ${c.p.score} điểm · ${c.p.accuracy}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
