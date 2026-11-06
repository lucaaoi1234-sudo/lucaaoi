import type { TrainingEngine } from "@/lib/game/engine";
import type { GraphicsQuality } from "@/lib/validation/schemas";

/**
 * Trạng thái chia sẻ giữa trang điều phối và renderer (3D hoặc 2D).
 * - `aim` là điểm ngắm dạng NDC [-1, 1]. Tâm ngắm trên màn hình luôn đặt tại đúng điểm này.
 * - `fire` do renderer gán: thực hiện raycast/hit-test rồi gọi engine.shoot().
 */
export interface TrainingRuntime {
  engine: TrainingEngine;
  aim: { x: number; y: number };
  /** true khi con trỏ đang bị khóa (Pointer Lock) và dùng độ nhạy; false thì tâm ngắm bám đúng con trỏ hệ thống. */
  locked: boolean;
  quality: GraphicsQuality;
  fovDeg: number;
  fire: (() => void) | null;
}

export interface RendererCallbacks {
  /** Renderer đã sẵn sàng (đã đo vùng loại trừ, đã có khung hình đầu tiên). */
  onReady: () => void;
  /** Lỗi không thể khắc phục (ví dụ mất WebGL context). */
  onFatal: (message: string) => void;
}
