"use client";

import {
  DIFFICULTY_INFO,
  DIFFICULTIES,
  DURATIONS_SEC,
  MODE_INFO,
  TRAINING_MODES,
  type Difficulty,
  type DurationSec,
  type TrainingMode,
} from "@/lib/game/config";
import { Alert, Button, Card } from "../ui";
import { ModeBadge } from "../ModeBadge";

export interface SessionConfig {
  mode: TrainingMode;
  durationSec: DurationSec;
  difficulty: Difficulty;
}

export function MenuPanel({
  config,
  onChange,
  onStart,
  canStart,
  startLabel,
  webglNotice,
  guestNotice,
  error,
}: {
  config: SessionConfig;
  onChange: (next: SessionConfig) => void;
  onStart: () => void;
  canStart: boolean;
  startLabel: string;
  webglNotice: string | null;
  guestNotice: boolean;
  error: string | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card title="Chọn chế độ" subtitle="Mỗi chế độ đo một kỹ năng khác nhau.">
          <div role="radiogroup" aria-label="Chế độ luyện tập" className="grid gap-3 sm:grid-cols-2">
            {TRAINING_MODES.map((mode) => {
              const active = config.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...config, mode })}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-neon/60 bg-neon/10 shadow-[0_0_30px_-12px_rgba(34,211,238,0.9)]"
                      : "border-white/10 bg-white/[0.02] hover:border-neon/30 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ModeBadge mode={mode} compact />
                    {active && <span className="text-xs text-neon">Đã chọn</span>}
                  </div>
                  <p className="mt-2 font-semibold text-white">{MODE_INFO[mode].label}</p>
                  <p className="mt-1 text-sm text-slate-400">{MODE_INFO[mode].description}</p>
                  <p className="mt-2 text-xs text-slate-500">Chỉ số chính: {MODE_INFO[mode].metric}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Thời lượng">
            <div role="radiogroup" aria-label="Thời lượng" className="flex flex-wrap gap-2">
              {DURATIONS_SEC.map((d) => (
                <Chip key={d} active={config.durationSec === d} onClick={() => onChange({ ...config, durationSec: d })}>
                  {d} giây
                </Chip>
              ))}
            </div>
          </Card>
          <Card title="Độ khó">
            <div role="radiogroup" aria-label="Độ khó" className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <Chip key={d} active={config.difficulty === d} onClick={() => onChange({ ...config, difficulty: d })}>
                  {DIFFICULTY_INFO[d].label}
                </Chip>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <aside className="space-y-4">
        <Card title="Bắt đầu">
          <ul className="mb-5 space-y-2 text-sm text-slate-300">
            <li>• Di chuyển chuột để ngắm, nhấn chuột trái để bắn.</li>
            <li>• Esc hoặc P để tạm dừng, Space để tiếp tục khi đang tạm dừng.</li>
            <li>• Khi bắt đầu, trình duyệt sẽ khóa con trỏ để ngắm chính xác hơn.</li>
          </ul>
          <Button variant="primary" className="w-full py-3 text-base" onClick={onStart} disabled={!canStart}>
            ▶ {startLabel}
          </Button>
          {guestNotice && (
            <p className="mt-4 text-xs text-slate-400">
              Bạn đang chơi với tư cách khách. Kết quả được lưu trên trình duyệt này.{" "}
              <a href="/register" className="text-neon hover:underline">
                Đăng ký
              </a>{" "}
              để lưu lên tài khoản.
            </p>
          )}
        </Card>
        {webglNotice && <Alert tone="warn">{webglNotice}</Alert>}
        {error && <Alert>{error}</Alert>}
      </aside>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm transition ${
        active ? "border-neon/60 bg-neon/15 text-neon" : "border-white/10 text-slate-300 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
