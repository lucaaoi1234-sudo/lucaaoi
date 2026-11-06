import type { Metadata } from "next";
import { TrainingPage } from "@/components/train/TrainingPage";
import { isDifficulty, isDurationSec, isTrainingMode, type Difficulty, type TrainingMode } from "@/lib/game/config";

export const metadata: Metadata = { title: "Phòng tập 3D" };

interface SearchParams {
  mode?: string | string[];
  duration?: string | string[];
  difficulty?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Tham số trên URL chỉ dùng để chọn sẵn cấu hình; mọi giá trị lạ đều bị bỏ qua. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const modeRaw = first(sp.mode)?.toUpperCase();
  const durationRaw = Number(first(sp.duration));
  const difficultyRaw = first(sp.difficulty)?.toUpperCase();

  const preset = {
    mode: modeRaw && isTrainingMode(modeRaw) ? (modeRaw as TrainingMode) : undefined,
    durationSec: isDurationSec(durationRaw) ? durationRaw : undefined,
    difficulty: difficultyRaw && isDifficulty(difficultyRaw) ? (difficultyRaw as Difficulty) : undefined,
  };
  return <TrainingPage preset={preset} />;
}
