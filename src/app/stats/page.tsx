import type { Metadata } from "next";
import { StatsView } from "@/components/StatsView";

export const metadata: Metadata = { title: "Thống kê" };

export default function StatsPage() {
  return <StatsView />;
}
