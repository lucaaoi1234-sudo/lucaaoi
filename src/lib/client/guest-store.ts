import { z } from "zod";
import { DEFAULT_SETTINGS, settingsSchema, type SettingsInput } from "../validation/schemas";
import type { SessionRecord } from "../stats/aggregate";

/**
 * Lưu trữ cho khách (chưa đăng nhập) trong localStorage.
 * Mọi dữ liệu đọc lại đều được kiểm tra bằng Zod: nếu hỏng thì bỏ qua thay vì làm sập trang.
 */

const HISTORY_KEY = "aimforge.guest.sessions.v1";
const SETTINGS_KEY = "aimforge.guest.settings.v1";
export const GUEST_HISTORY_LIMIT = 300;

const recordSchema = z.object({
  id: z.string().min(1).max(64),
  mode: z.enum(["FLICK", "TRACKING", "REACTION", "PRECISION"]),
  difficulty: z.enum(["EASY", "NORMAL", "HARD"]),
  durationSec: z.number().int(),
  score: z.number().min(0),
  shots: z.number().int().min(0),
  hits: z.number().int().min(0),
  misses: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  maxStreak: z.number().int().min(0),
  avgReactionMs: z.number().nullable(),
  bestReactionMs: z.number().nullable(),
  avgTimeToHitMs: z.number().nullable(),
  trackingPct: z.number().nullable(),
  precisionPct: z.number().nullable(),
  createdAt: z.string().min(10).max(40),
});

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage !== undefined;
  } catch {
    return false;
  }
}

export type GuestRecord = SessionRecord & { id: string };

export function loadGuestSessions(): GuestRecord[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const records: GuestRecord[] = [];
    for (const item of parsed.data) {
      const ok = recordSchema.safeParse(item);
      if (ok.success) records.push(ok.data);
    }
    return records;
  } catch {
    return [];
  }
}

export function appendGuestSession(record: GuestRecord): GuestRecord[] {
  const next = [...loadGuestSessions(), record].slice(-GUEST_HISTORY_LIMIT);
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      throw new Error("Không thể lưu lịch sử vào trình duyệt (bộ nhớ đầy hoặc đang ở chế độ riêng tư).");
    }
  }
  return next;
}

export function clearGuestSessions(): void {
  if (storageAvailable()) window.localStorage.removeItem(HISTORY_KEY);
}

export function loadGuestSettings(): SettingsInput {
  if (!storageAvailable()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGuestSettings(settings: SettingsInput): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    throw new Error("Không thể lưu cài đặt vào trình duyệt.");
  }
}
