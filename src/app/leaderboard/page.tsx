import type { Metadata } from "next";
import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata: Metadata = { title: "Bảng xếp hạng" };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
