import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/client/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AimForge — Luyện aim 3D trên trình duyệt",
    template: "%s · AimForge",
  },
  description: "AimForge là ứng dụng luyện aim 3D trên trình duyệt với 4 chế độ Flick, Tracking, Reaction và Precision.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04060c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
