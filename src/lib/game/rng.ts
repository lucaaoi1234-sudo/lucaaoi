/** Bộ sinh số giả ngẫu nhiên có seed (mulberry32) để kết quả kiểm thử có thể lặp lại. */

export interface Rng {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số thực trong [min, max). */
  range(min: number, max: number): number;
  /** Số nguyên trong [min, max]. */
  int(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
  };
}

/** Seed ngẫu nhiên dùng khi chơi thật (không dùng trong test). */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] ?? 1;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
