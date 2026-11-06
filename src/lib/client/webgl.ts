export type WebGLStatus = { supported: boolean; reason?: string };

let cachedStatus: WebGLStatus | null = null;

/** Trả về kết quả kiểm tra WebGL, chỉ thực hiện một lần cho mỗi trang. */
export function getWebGLStatus(): WebGLStatus {
  cachedStatus ??= detectWebGL();
  return cachedStatus;
}

/** Kiểm tra trình duyệt/thiết bị có hỗ trợ WebGL hay không (trước khi mount Canvas của Three.js). */
export function detectWebGL(): WebGLStatus {
  if (typeof document === "undefined") return { supported: false, reason: "Chưa chạy trên trình duyệt" };
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { supported: false, reason: "Trình duyệt hoặc driver không bật WebGL" };
    // Ngăn GPU bị khoá do tạo quá nhiều context.
    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return { supported: true };
  } catch {
    return { supported: false, reason: "Không thể khởi tạo WebGL" };
  }
}
