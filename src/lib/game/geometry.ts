/**
 * Toán học màn hình (không phụ thuộc Three.js).
 * Tọa độ NDC: x, y trong [-1, 1], gốc ở giữa màn hình, y hướng lên trên.
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Viewport {
  /** Tỉ lệ khung hình (rộng / cao). */
  aspect: number;
  /** Góc nhìn dọc (độ). */
  fovYDeg: number;
}

const DEG = Math.PI / 180;

/**
 * Bán kính bia theo NDC-y để bia có bán kính góc `radiusDeg` (độ) với góc nhìn dọc `fovYDeg`.
 * Nhờ vậy bia có kích thước "góc nhìn" không đổi dù FOV thay đổi.
 */
export function angularRadiusToNdc(radiusDeg: number, fovYDeg: number): number {
  return Math.tan(radiusDeg * DEG) / Math.tan((fovYDeg / 2) * DEG);
}

export function rectsOverlapCircle(rects: readonly Rect[], u: number, v: number, rx: number, ry: number): boolean {
  for (const r of rects) {
    if (u + rx > r.x0 && u - rx < r.x1 && v + ry > r.y0 && v - ry < r.y1) return true;
  }
  return false;
}

/** Khoảng cách hai điểm NDC đã hiệu chỉnh theo tỉ lệ khung hình (để tròn trên màn hình). */
export function ndcDistance(ax: number, ay: number, bx: number, by: number, aspect: number): number {
  const dx = (ax - bx) * aspect;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

/** Kẹp điểm ngắm vào trong khung hình. */
export function clampAim(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(1, Math.max(-1, x)), y: Math.min(1, Math.max(-1, y)) };
}
