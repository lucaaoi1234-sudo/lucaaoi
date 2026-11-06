/** Lớp gọi API phía trình duyệt: chuẩn hoá lỗi và đọc thông điệp tiếng Việt từ server. */

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  };
  if (options.body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Không kết nối được tới máy chủ. Kiểm tra mạng và thử lại.", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: unknown; details?: unknown };
    const message = typeof body.error === "string" ? body.error : `Yêu cầu thất bại (${res.status})`;
    const details = Array.isArray(body.details) ? body.details.filter((d): d is string => typeof d === "string") : [];
    throw new ApiError(message, res.status, details);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.details.length > 0 ? `${error.message}: ${error.details.join("; ")}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi không xác định";
}
