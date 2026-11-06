"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { errorMessage } from "@/lib/client/api";

const NAV = [
  { href: "/", label: "Tổng quan" },
  { href: "/train", label: "Luyện tập" },
  { href: "/stats", label: "Thống kê" },
  { href: "/leaderboard", label: "Bảng xếp hạng" },
  { href: "/settings", label: "Cài đặt" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await logout();
      // Chuyển về trang chủ và làm mới dữ liệu máy chủ để xoá dữ liệu người dùng đang hiển thị.
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-400/10 bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-neon/50 bg-neon/10">
            <span className="h-3 w-3 rounded-full border-2 border-neon shadow-[0_0_12px_#22d3ee]" />
          </span>
          <span className="text-lg font-bold tracking-wider text-white">
            AIM<span className="text-neon">FORGE</span>
          </span>
        </Link>

        <nav aria-label="Điều hướng chính" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-neon/15 text-neon" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          {loading ? (
            <span className="text-slate-500">Đang kiểm tra…</span>
          ) : user ? (
            <>
              <span className="hidden text-slate-300 md:inline">
                Xin chào, <strong className="text-white">{user.displayName}</strong>
              </span>
              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200 hover:bg-white/5 disabled:opacity-50"
              >
                {busy ? "Đang đăng xuất…" : "Đăng xuất"}
              </button>
            </>
          ) : (
            <>
              <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200 md:inline">
                Chế độ khách
              </span>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-slate-200 hover:bg-white/5">
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-cyan-400 to-sky-500 px-3 py-1.5 font-semibold text-slate-950"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
        {error && <p className="w-full text-xs text-rose-300">{error}</p>}
      </div>
    </header>
  );
}
