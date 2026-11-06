"use client";

import type { EngineSnapshot } from "@/lib/game/engine";
import { DIFFICULTY_INFO, MODE_INFO, type Difficulty, type TrainingMode } from "@/lib/game/config";
import { formatMs, formatNumber, formatPct } from "../ui";

export interface Popup {
  id: number;
  text: string;
  x: number;
  y: number;
  tone: "hit" | "miss" | "info";
}

export function Hud({
  snap,
  mode,
  difficulty,
  onPause,
}: {
  snap: EngineSnapshot;
  mode: TrainingMode;
  difficulty: Difficulty;
  onPause: () => void;
}) {
  const seconds = Math.ceil(snap.remainingMs / 1000);
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const lowTime = snap.remainingMs <= 5000;

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {/* Trên trái: chế độ */}
      <div className="absolute left-3 top-3 rounded-xl border border-cyan-400/20 bg-slate-950/60 px-3 py-2 backdrop-blur sm:left-5 sm:top-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">Chế độ</p>
        <p className="text-sm font-semibold">
          {MODE_INFO[mode].label} · {DIFFICULTY_INFO[difficulty].label}
        </p>
      </div>

      {/* Trên giữa: thời gian */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-xl border border-cyan-400/20 bg-slate-950/60 px-5 py-2 text-center backdrop-blur sm:top-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">Thời gian</p>
        <p className={`text-2xl font-bold tabular-nums ${lowTime ? "text-rose-300" : "text-white"}`}>{timer}</p>
      </div>

      {/* Trên phải: tạm dừng */}
      <div className="pointer-events-auto absolute right-3 top-3 sm:right-5 sm:top-5">
        <button
          type="button"
          onClick={onPause}
          className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 backdrop-blur hover:bg-white/10"
          aria-label="Tạm dừng (Esc)"
        >
          ❚❚ Tạm dừng <span className="ml-1 text-slate-500">Esc</span>
        </button>
      </div>

      {/* Dưới trái: điểm và độ chính xác */}
      <div className="absolute bottom-3 left-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-cyan-400/20 bg-slate-950/60 px-4 py-3 backdrop-blur sm:bottom-5 sm:left-5">
        <div className="col-span-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">Điểm</p>
          <p className="text-3xl font-bold tabular-nums text-neon-2">{formatNumber(snap.score)}</p>
        </div>
        <HudStat label="Chính xác" value={formatPct(snap.accuracy)} />
        <HudStat label="Trúng / Bắn" value={`${snap.hits} / ${snap.shots}`} />
        <HudStat label="Chuỗi trúng" value={formatNumber(snap.streak)} />
        <HudStat label="Chuỗi tốt nhất" value={formatNumber(snap.maxStreak)} />
      </div>

      {/* Dưới phải: chỉ số riêng của chế độ */}
      <div className="absolute bottom-3 right-3 min-w-[170px] rounded-xl border border-cyan-400/20 bg-slate-950/60 px-4 py-3 text-right backdrop-blur sm:bottom-5 sm:right-5">
        {mode === "FLICK" && (
          <>
            <HudStat label="TB thời gian bắn trúng" value={formatMs(snap.avgTimeToHitMs)} align="right" />
            <HudStat label="Bia đã bỏ lỡ" value={formatNumber(snap.expired)} align="right" />
          </>
        )}
        {mode === "TRACKING" && <HudStat label="Tỉ lệ bám trúng" value={formatPct(snap.trackingPct)} align="right" />}
        {mode === "REACTION" && (
          <>
            <HudStat label="Phản ứng gần nhất" value={formatMs(snap.lastReactionMs)} align="right" />
            <HudStat label="Tốt nhất" value={formatMs(snap.bestReactionMs)} align="right" />
          </>
        )}
        {mode === "PRECISION" && (
          <>
            <HudStat label="Chính xác tâm" value={formatPct(snap.precisionPct)} align="right" />
            <HudStat label="Bia đã bỏ lỡ" value={formatNumber(snap.expired)} align="right" />
          </>
        )}
      </div>
    </div>
  );
}

function HudStat({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "mt-1 first:mt-0" : ""}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="text-base font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

/** Dấu ngắm trúng/trượt quanh tâm ngắm. `version` đổi mỗi lần để chạy lại animation. */
export function HitMarker({ kind, version }: { kind: "hit" | "miss"; version: number }) {
  const color = kind === "hit" ? "#fff" : "#fb7185";
  return (
    <svg key={version} width="56" height="56" viewBox="0 0 56 56" className="animate-hitmarker absolute left-0 top-0" aria-hidden="true">
      <g stroke={color} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
        <line x1="14" y1="14" x2="22" y2="22" />
        <line x1="42" y1="14" x2="34" y2="22" />
        <line x1="14" y1="42" x2="22" y2="34" />
        <line x1="42" y1="42" x2="34" y2="34" />
      </g>
    </svg>
  );
}
