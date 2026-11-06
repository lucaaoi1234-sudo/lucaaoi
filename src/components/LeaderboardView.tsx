"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { DIFFICULTY_INFO, MODE_INFO, TRAINING_MODES, type TrainingMode } from "@/lib/game/config";
import type { LeaderboardEntry } from "@/lib/server/services";
import { Alert, Card, EmptyState, formatDate, formatNumber, formatPct, PageHeader, Spinner } from "./ui";
import { ModeBadge } from "./ModeBadge";

type DurationOption = "all" | "30" | "60" | "120";

interface LeaderboardResult {
  key: string;
  entries: LeaderboardEntry[];
  error: string | null;
}

export function LeaderboardView() {
  const { user } = useAuth();
  const [mode, setMode] = useState<TrainingMode>("FLICK");
  const [duration, setDuration] = useState<DurationOption>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const queryKey = `${mode}|${duration}|${reloadKey}`;
  // Đang tải khi kết quả hiện có không thuộc truy vấn hiện tại.
  const loading = result?.key !== queryKey;
  const entries = result?.key === queryKey ? result.entries : [];
  const error = result?.key === queryKey ? result.error : null;
  const status: "loading" | "ready" | "error" = loading ? "loading" : error ? "error" : "ready";

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ mode, durationSec: duration });
    apiRequest<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?${query.toString()}`)
      .then((data) => {
        if (!cancelled) setResult({ key: queryKey, entries: data.entries, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key: queryKey, entries: [], error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
    // queryKey gộp mode/duration/reloadKey nên không cần liệt kê riêng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return (
    <>
      <PageHeader
        eyebrow="Cạnh tranh"
        title="Bảng xếp hạng"
        description="Mỗi người chơi xuất hiện một lần với buổi tập điểm cao nhất trong bộ lọc. Chỉ người dùng đã đăng nhập mới được xếp hạng."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Chế độ" className="flex flex-wrap gap-2">
          {TRAINING_MODES.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl border px-4 py-2 text-sm transition ${
                mode === m ? "border-neon/60 bg-neon/15 text-neon" : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          Thời lượng
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as DurationOption)}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-cyan-400/60 focus:outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="30">30 giây</option>
            <option value="60">60 giây</option>
            <option value="120">120 giây</option>
          </select>
        </label>
      </div>

      <Card
        title={`Top · ${MODE_INFO[mode].label}`}
        subtitle={MODE_INFO[mode].description}
        actions={<ModeBadge mode={mode} compact />}
      >
        {status === "loading" && <Spinner />}
        {status === "error" && (
          <div className="space-y-3">
            <Alert>{error}</Alert>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="text-sm text-neon hover:underline">
              Thử tải lại
            </button>
          </div>
        )}
        {status === "ready" && entries.length === 0 && (
          <EmptyState
            title="Chưa có ai trên bảng này"
            description="Đăng nhập và hoàn thành một buổi tập để là người đầu tiên lên bảng xếp hạng."
          />
        )}
        {status === "ready" && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Người chơi</th>
                  <th className="py-2 pr-3 text-right font-medium">Điểm</th>
                  <th className="py-2 pr-3 text-right font-medium">Chính xác</th>
                  <th className="py-2 pr-3 text-right font-medium">Chuỗi</th>
                  <th className="py-2 pr-3 font-medium">Thời lượng</th>
                  <th className="py-2 font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((e) => {
                  const isMe = !!user && e.displayName === user.displayName;
                  return (
                    <tr key={`${e.rank}-${e.displayName}`} className={isMe ? "bg-neon/5 text-white" : "text-slate-200"}>
                      <td className="py-2.5 pr-3 font-semibold tabular-nums">
                        <span className={e.rank <= 3 ? "text-neon-2" : "text-slate-400"}>{e.rank}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {e.displayName}
                        {isMe && <span className="ml-2 text-xs text-neon">(bạn)</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-white">{formatNumber(e.score)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatPct(e.accuracy)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(e.maxStreak)}</td>
                      <td className="py-2.5 pr-3">
                        {e.durationSec}s · {DIFFICULTY_INFO[e.difficulty].label}
                      </td>
                      <td className="py-2.5 text-slate-400">{formatDate(e.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
