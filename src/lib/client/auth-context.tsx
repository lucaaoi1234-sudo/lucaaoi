"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "./api";

export interface ClientUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthState {
  user: ClientUser | null;
  /** true khi đang kiểm tra phiên lần đầu. */
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: ClientUser | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Kiểm tra phiên lần đầu khi tải trang. Chỉ cập nhật state sau khi có phản hồi.
  useEffect(() => {
    let active = true;
    apiRequest<{ user: ClientUser | null }>("/api/auth/me")
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        // Không lấy được trạng thái: coi như khách để vẫn chơi được.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ user: ClientUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const data = await apiRequest<{ user: ClientUser }>("/api/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: {} });
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}
