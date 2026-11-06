# AimForge

Ứng dụng web luyện aim 3D chạy trên trình duyệt. Nhân vật cầm blaster giả tưởng (không mô phỏng vũ khí thật), bia là hologram.

- **Stack:** Next.js (App Router) · React · TypeScript · React Three Fiber + Drei · Tailwind CSS · PostgreSQL + Prisma · Zod · JWT (jose) trong cookie httpOnly · bcryptjs.
- **Chế độ:** Flick, Tracking, Reaction, Precision. Chọn thời lượng (30/60/120 giây) và độ khó (Dễ/Thường/Khó).
- **Khách vs tài khoản:** khách chơi ngay, kết quả và cài đặt lưu trong `localStorage` của trình duyệt, không gửi gì lên server. Tài khoản lưu buổi tập và cài đặt trên máy chủ.
- **Không có WebGL:** tự chuyển sang chế độ 2D dự phòng (DOM) với cùng quy tắc tính điểm. Có thể chọn chế độ 2D thủ công ở màn hình luyện tập.

## Yêu cầu

- Node.js **>= 20.9** và npm
- Docker (khuyến nghị) hoặc một PostgreSQL 14+ tự cài

## Cài đặt và chạy

```bash
# 1. Biến môi trường
cp .env.example .env
# Sửa AUTH_SECRET trong .env: openssl rand -base64 48

# 2. PostgreSQL (khớp với DATABASE_URL trong .env.example)
docker compose up -d db

# 3. Cài dependency (postinstall sẽ chạy prisma generate)
npm install

# 4. Tạo bảng trong database
npm run db:migrate          # prisma migrate deploy (áp dụng migration trong prisma/migrations)

# 5. Chạy ứng dụng
npm run dev                 # http://localhost:3000 (lắng nghe 0.0.0.0)
```

Chạy production:

```bash
npm run build
npm run start               # http://localhost:3000
```

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | có | Chuỗi kết nối PostgreSQL (`postgresql://...`). Chỉ đọc trên server. |
| `AUTH_SECRET` | có | Khóa ký JWT HS256, tối thiểu 32 ký tự ngẫu nhiên. Không được để giá trị mẫu. |
| `SESSION_TTL_DAYS` | không | Thời hạn phiên đăng nhập, mặc định 7 ngày. |
| `COOKIE_SECURE` | không | `true`/`false`. Mặc định bật khi `NODE_ENV=production`. |

Không biến nào có tiền tố `NEXT_PUBLIC_`. Không có secret hay chuỗi kết nối DB nào được gửi xuống trình duyệt.

## Lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy máy chủ phát triển |
| `npm run build` | `prisma generate` + build production |
| `npm run start` | Chạy bản build production |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: logic điểm, accuracy, thống kê, schema, engine |
| `npm run db:migrate` | Áp dụng migration |
| `npm run db:studio` | Mở Prisma Studio |

## Điều khiển

- **Chuột:** di chuyển để ngắm, chuột trái để bắn. Khi bắt đầu, con trỏ được khóa (Pointer Lock) để ngắm như FPS.
- **Esc** hoặc **P**: tạm dừng. **Space**: tạm dừng/tiếp tục. **R** (khi đang tạm dừng): chơi lại.
- Nếu trình duyệt thoát khóa con trỏ khi đang chơi, buổi tập tự tạm dừng.

## Quy tắc chấm điểm và dữ liệu

- Điểm, số lần bắn, số lần trúng, accuracy (= trúng / bắn), chuỗi trúng và các chỉ số theo chế độ được tính trong `src/lib/game/` (thuần TypeScript, có test).
- Trượt vẫn tính là một lượt bắn.
- Máy chủ **không tin** dữ liệu từ client: `userId` luôn lấy từ phiên đăng nhập; `misses` và `accuracy` do server tính; mọi trường được kiểm tra bằng Zod, kèm ràng buộc chéo (ví dụ trúng ≤ bắn, điểm ≤ mức tối đa có thể đạt được, số bia hợp lý theo thời lượng).
- Đăng nhập có giới hạn tần suất (rate limit trong bộ nhớ, theo từng tiến trình).

## Cấu trúc thư mục chính

```
prisma/                 schema và migration (User, TrainingSession, UserSettings)
src/app/                route App Router và API (/api/auth, /api/sessions, /api/stats, /api/settings, /api/leaderboard)
src/components/train/   phòng tập: TrainingPage (điều phối), TrainingScene (3D), Fallback2D, HUD, tổng kết
src/lib/game/           logic thuần: engine, scoring, cấu hình chế độ (có test)
src/lib/stats/          tổng hợp thống kê (có test)
src/lib/validation/     schema Zod dùng chung client/server (có test)
src/lib/server/         auth, env, db, rate limit, services (chỉ server)
src/lib/client/         API client, lưu trữ khách (localStorage), âm thanh, kiểm tra WebGL
```

## Giả định quan trọng

- Prisma dùng `queryCompiler` + `driverAdapters` với `@prisma/adapter-pg` và `engineType = "client"`, nên runtime không cần binary Rust. Khi đổi schema, chạy lại `npx prisma generate`.
- Rate limit lưu trong bộ nhớ tiến trình: chỉ đúng với một instance. Nhiều instance cần Redis hoặc tương đương.
- Khách không có lịch sử trên máy chủ; xóa localStorage sẽ mất lịch sử khách.
- Bảng xếp hạng chỉ hiển thị người dùng đã đăng nhập, mỗi người một buổi điểm cao nhất trong bộ lọc.
- Chất lượng đồ họa (LOW/MEDIUM/HIGH) điều chỉnh độ phân giải (DPR), khử răng cưa, bóng đổ, số hạt hiệu ứng và độ mịn của bia. Số bia đồng thời bị giới hạn theo độ khó (chế độ Flick độ khó Khó: tối đa 2 bia cùng lúc), không phụ thuộc chất lượng.
- Mặc định chất lượng là MEDIUM; có thể đổi trong trang Cài đặt.
