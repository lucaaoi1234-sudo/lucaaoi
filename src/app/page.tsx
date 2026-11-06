import type { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";

export const metadata: Metadata = { title: "Tổng quan" };

export default function HomePage() {
  return <DashboardView />;
}
