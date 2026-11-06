import "server-only";

/**
 * Giới hạn tần suất đơn giản theo cửa sổ thời gian cố định, lưu trong bộ nhớ tiến trình.
 * Ghi chú: khi chạy nhiều instance cần thay bằng kho chung (ví dụ Redis). Đây là lớp bảo vệ cơ bản.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Chỉ dùng trong test để đặt lại trạng thái. */
export function resetRateLimitForTests(): void {
  buckets.clear();
}
