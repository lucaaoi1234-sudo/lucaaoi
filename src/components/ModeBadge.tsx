import { MODE_INFO, type TrainingMode } from "@/lib/game/config";

const COLORS: Record<TrainingMode, string> = {
  FLICK: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  TRACKING: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  REACTION: "border-lime-400/40 bg-lime-400/10 text-lime-200",
  PRECISION: "border-amber-400/40 bg-amber-400/10 text-amber-200",
};

export function ModeBadge({ mode, compact = false }: { mode: TrainingMode; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium uppercase tracking-widest ${COLORS[mode]} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {MODE_INFO[mode].label}
    </span>
  );
}
