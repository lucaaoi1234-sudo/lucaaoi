"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { apiRequest, errorMessage } from "./api";
import { appendGuestSession, loadGuestSessions, loadGuestSettings, saveGuestSettings, type GuestRecord } from "./guest-store";
import { aggregateSessions, type SessionRecord, type StatsSummary } from "../stats/aggregate";
import { DEFAULT_SETTINGS, type SettingsInput } from "../validation/schemas";
import type { SessionResult } from "../game/engine";
import { toLocalRecord, toSubmitPayload } from "../game/submit";
import type { SessionDTO } from "../server/services";

export type LoadStatus = "loading" | "ready" | "error";

/** Cài đặt: tài khoản dùng máy chủ, khách dùng localStorage. */
export function useSettings() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SettingsInput>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        if (userId) {
          const data = await apiRequest<{ settings: SettingsInput }>("/api/settings");
          if (!cancelled) setSettings(data.settings);
        } else if (!cancelled) {
          setSettings(loadGuestSettings());
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(errorMessage(e));
          setStatus("error");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  const save = useCallback(
    async (next: SettingsInput) => {
      if (userId) {
        const data = await apiRequest<{ settings: SettingsInput }>("/api/settings", { method: "PUT", body: next });
        setSettings(data.settings);
        return data.settings;
      }
      saveGuestSettings(next);
      setSettings(next);
      return next;
    },
    [userId],
  );

  return { settings, status, error, save, isGuest: !userId };
}

/** Lưu một buổi tập: tài khoản → máy chủ; khách → localStorage. */
export async function persistSessionResult(
  result: SessionResult,
  signedIn: boolean,
): Promise<{ storage: "server" | "local"; record: SessionRecord | SessionDTO }> {
  if (signedIn) {
    const data = await apiRequest<{ session: SessionDTO }>("/api/sessions", {
      method: "POST",
      body: toSubmitPayload(result),
    });
    return { storage: "server", record: data.session };
  }
  const id = crypto.randomUUID();
  const record = toLocalRecord(result, id, new Date().toISOString());
  appendGuestSession(record);
  return { storage: "local", record };
}

/** Thống kê và lịch sử gần đây: tài khoản lấy từ máy chủ, khách tổng hợp từ localStorage. */
export function useStats(refreshKey = 0) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<SessionRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        if (userId) {
          const data = await apiRequest<{ summary: StatsSummary; recent: SessionDTO[] }>("/api/stats");
          if (!cancelled) {
            setSummary(data.summary);
            setRecent(data.recent);
          }
        } else {
          const local: GuestRecord[] = loadGuestSessions();
          const ordered = [...local].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
          if (!cancelled) {
            setSummary(aggregateSessions(local));
            setRecent(ordered.slice(0, 10));
          }
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(errorMessage(e));
          setStatus("error");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, refreshKey]);

  return { summary, recent, status, error, isGuest: !userId };
}
