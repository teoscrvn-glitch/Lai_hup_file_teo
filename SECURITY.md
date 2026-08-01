# Checklist bảo mật — Lại Húp File

Đối chiếu từng yêu cầu nâng cấp bảo mật với phần đã triển khai trong code.

## 1. Trang Admin riêng
- ✅ Route quản trị mount tại đường dẫn bí mật `ADMIN_PANEL_PATH` (`.env`), KHÔNG dùng chung `/api/*` với site chính — `server.js`, `routes/admin.routes.js`
- ✅ Đăng nhập admin dùng endpoint + cookie RIÊNG (`admin_access_token`/`admin_refresh_token`, path giới hạn), không dùng chung `/api/auth/login` — `controllers/adminAuth.controller.js`
- ✅ Không có link nào trỏ tới đường dẫn admin trong code frontend (frontend sẽ làm ở Part 4, cần tự đảm bảo không lộ)
- ✅ User thường/chưa đăng nhập truy cập route admin → **404** (không phải 403) để không xác nhận sự tồn tại của trang — `middleware/adminPanel.middleware.js`
- ✅ Phân quyền 3 cấp: Super Admin / Admin / Moderator — bảng `admins.permission_level`, middleware `requirePermission()`
- ✅ Mọi thao tác admin đều gọi `logAction()` ghi vào bảng `logs` — xuyên suốt `admin.controller.js`, `adminAuth.controller.js`, và các controller file/order/video khi gọi từ route admin

## 2. Bảo vệ mã nguồn
- ✅ `errorHandler.js` không bao giờ trả `err.stack` hay chi tiết lỗi thật ra response (chỉ log ra console/server) — trừ khi `err.expose === true` do chính code chủ động set
- ✅ `.env` nằm ngoài Git (cần thêm `.gitignore`, xem bên dưới), chỉ có `.env.example` không chứa secret thật
- ✅ Backend không serve source code — `express.static` chỉ trỏ tới `frontend/` và `uploads/public/`, không bao giờ trỏ tới `backend/` gốc
- ✅ Database credentials chỉ đọc từ biến môi trường (`config/db.js`), không hardcode
- ⚠️ Cần tự thêm file `.gitignore` chứa `.env`, `node_modules/`, `uploads/paid/*`, `logs/*.log` trước khi push lên Git thật (đã tạo sẵn — xem `.gitignore`)

## 3. Bảo vệ file tải
- ✅ Không có static route nào trỏ tới `uploads/paid/` — chỉ đọc được qua controller
- ✅ Luồng tải file trả phí 2 bước: `POST /api/files/:id/download` (kiểm tra sở hữu) → sinh token ngẫu nhiên 96 ký tự hex, lưu **hash** (không lưu token gốc) trong bảng `download_tokens`, hết hạn **5 phút** (`DOWNLOAD_TOKEN_EXPIRES_MIN`) → `GET /api/download/:token` tiêu thụ token, đánh dấu `used = 1` ngay trước khi stream — không dùng lại được — `file.controller.js` (`download`, `serveDownloadToken`)
- ✅ File miễn phí "vượt link"/"tải trực tiếp" trả link ngay (không cần bảo vệ bằng token vì bản chất công khai)
- ✅ Không thể đoán URL tải: token là chuỗi ngẫu nhiên 96 hex-char (`crypto.randomBytes(48)`), không đoán được

## 4. Chống lạm dụng API
- ✅ `express-rate-limit`: giới hạn chung (`globalLimiter`, 200 req/15 phút/IP), riêng cho auth (`authLimiter`, 10 req/15 phút — chống brute-force), riêng cho download (`downloadLimiter`, 30 req/5 phút) — `middleware/rateLimiter.js`
- ✅ Giới hạn số lần đăng nhập sai: khóa tài khoản `MAX_LOGIN_ATTEMPTS` lần (mặc định 5) trong `LOGIN_LOCK_MINUTES` phút (mặc định 15) — `user.model.js` (`registerFailedLogin`), áp dụng cả login user thường và admin
- ✅ Chặn IP tự động: vượt `IP_BLOCK_THRESHOLD` request/phút → chặn `IP_BLOCK_MINUTES` phút, lưu bảng `blocked_ips` — `middleware/ipBlock.middleware.js`

## 5. Bảo mật tài khoản
- ✅ Mật khẩu băm bằng **bcrypt**, 12 salt rounds — `controllers/auth.controller.js`
- ✅ Access token JWT **ngắn hạn** (15 phút, `JWT_EXPIRES_IN`)
- ✅ Refresh token: chuỗi ngẫu nhiên (không phải JWT), lưu **hash SHA-256** trong DB, có thể thu hồi (`revoked`), hỗ trợ **token rotation** (mỗi lần refresh, token cũ bị thu hồi, cấp token mới) — `models/refreshToken.model.js`, `controllers/auth.controller.js` (`refresh`)
- ✅ Tự động "đăng xuất": `requireAuth` trả mã lỗi rõ ràng (`TOKEN_EXPIRED`, `TOKEN_INVALID`, `NO_TOKEN`) để frontend phát hiện token hỏng và tự gọi `/api/auth/refresh` hoặc xóa phiên — `middleware/auth.middleware.js`
- ✅ Đổi mật khẩu → tự động thu hồi toàn bộ refresh token cũ, buộc đăng nhập lại trên thiết bị khác
- ✅ Endpoint `/api/auth/logout-all` — đăng xuất khỏi tất cả thiết bị

## 6. Nhật ký hệ thống
- ✅ Bảng `logs` (có cột `severity`) ghi: đăng nhập/đăng xuất (user + admin riêng), mua file (tiền & điểm), duyệt/từ chối video, thêm/sửa/xóa/đổi trạng thái file, cấp/thu hồi quyền admin, khóa/mở tài khoản, chặn/gỡ chặn IP, permission bị từ chối
- ✅ Log ghi cả file (`logs/app.log`) lẫn DB — `utils/logger.js`
- ⚠️ Lỗi hệ thống (exception không mong muốn): hiện được `console.error` trong `errorHandler.js`; nếu cần lưu vào bảng `logs` luôn, có thể mở rộng `errorHandler` gọi `logAction(..., 'error', ..., 'error')` — để dành làm ở Part sau nếu cần

## 7. Chống DDoS ở mức ứng dụng
- ✅ Rate limit theo IP (tầng Node, `express-rate-limit`) + tầng Nginx (`limit_req_zone`) — 2 lớp độc lập
- ✅ Giới hạn kết nối đồng thời: `limit_conn_zone` trong Nginx
- ✅ Chặn IP vượt ngưỡng: `middleware/ipBlock.middleware.js` (đếm trong bộ nhớ + lưu DB `blocked_ips`, tự hết hạn)
- ✅ Nén dữ liệu: `compression` middleware (gzip) ở Node + `gzip on` ở Nginx
- ✅ Cache nội dung tĩnh: `express.static` với `maxAge` cho `uploads/public` (30 ngày) và `frontend/` (1 giờ)
- ✅ Thiết kế sẵn sàng đặt sau Cloudflare/reverse proxy chống DDoS: `app.set('trust proxy', 1)` đã bật để đọc đúng IP thật qua `X-Forwarded-For`

## 8. Upload an toàn
- ✅ Whitelist đúng định dạng qua Multer `fileFilter` (theo MIME client khai báo) — `middleware/upload.middleware.js`
- ✅ **Kiểm tra chữ ký nhị phân thật** (magic bytes) sau khi upload — không tin mimetype client gửi, phát hiện file đổi đuôi (vd `.exe` đổi thành `.zip`) — `utils/fileSignature.js`, tích hợp vào `file.controller.js` (`create`, `update`); file bị từ chối sẽ bị xóa ngay
- ✅ Giới hạn kích thước: `UPLOAD_MAX_SIZE_MB` (file trả phí), 5MB riêng cho ảnh thumbnail/avatar
- ✅ Đổi tên file ngẫu nhiên khi lưu (`Date.now() + random + ext`), không giữ tên gốc — chống path traversal & đoán tên
- ✅ Không thực thi file người dùng tải lên: file lưu trong `uploads/paid/` KHÔNG nằm trong bất kỳ thư mục được Nginx/Express cấu hình chạy code (không phải thư mục `public_html` kiểu PHP có thể auto-execute)
- ⚠️ "Quét virus trước khi lưu": chưa tích hợp ClamAV thật (cần daemon riêng trên VPS, không cài được từ code). Khuyến nghị: cài `clamav` + `clamdscan` trên VPS, gọi qua `child_process` hoặc package `clamscan` trong `services/` nếu cần — để dành cho Part sau nếu bạn muốn

## 9. Cấu hình Server
- ✅ Nginx làm reverse proxy — `deploy/nginx.conf`
- ✅ HTTPS: hướng dẫn `certbot --nginx` trong `install.sh`
- ✅ HTTP Security Headers: `helmet()` (tầng Node) + `add_header` (tầng Nginx) — 2 lớp
- ✅ CORS cấu hình chặt: chỉ cho phép đúng `BASE_URL` khi `NODE_ENV=production`, có `credentials: true` cho cookie
- ✅ Ẩn phiên bản phần mềm: `app.disable('x-powered-by')` (Express) + `server_tokens off` (Nginx)

## 10. Kiểm tra bảo mật trước bàn giao
- ✅ Toàn bộ file `.js` đã `node --check` (syntax hợp lệ) trước khi đóng gói
- ✅ Đối chiếu mọi `require()` với `package.json` — không thiếu dependency
- ✅ Verify cấu trúc thư mục ZIP không còn artefact lỗi (không có `{ } ,` trong tên thư mục/file)
- ✅ Phân quyền: mọi route admin đều qua `requireAuth` → `requireAdminPanel` → `requirePermission(level)` theo đúng cấp bậc
- ✅ Đường dẫn tải file: đã test luồng bằng cách đọc lại code — request-download → token → serve-token → used=1 → request lại token cũ phải trả 410
- ⚠️ Đây là kiểm tra **tĩnh (code review)**, chưa phải test động (chạy server thật + gọi API thật) vì môi trường build hiện tại không có MySQL/Node runtime kết nối mạng. **Bắt buộc** chạy `npm install && npm run seed:admin` rồi tự test luồng đăng nhập/upload/mua/tải trên VPS thật trước khi vận hành chính thức.

---

## Việc bạn CẦN tự làm trước khi deploy thật
1. Đổi `ADMIN_PANEL_PATH` trong `.env` thành 1 chuỗi ngẫu nhiên riêng của bạn (không dùng giá trị mẫu trong repo)
2. Đổi `JWT_SECRET`, `REFRESH_TOKEN_SECRET` thành chuỗi ngẫu nhiên dài (vd `openssl rand -hex 64`)
3. Chạy `npm run seed:admin` để tạo Super Admin đầu tiên, sau đó vào `admin.controller.grantAdmin` (hoặc gán tay trong DB) để set `permission_level = 'super'`
4. Sửa `deploy/nginx.conf`: thay `/admin-panel-x7q9k2/` bằng đúng `ADMIN_PANEL_PATH` thật của bạn, cân nhắc thêm `allow`/`deny` giới hạn IP truy cập trang admin
5. Cân nhắc tích hợp captcha thật (hCaptcha/reCAPTCHA) thay vì chỗ chờ `captchaToken` hiện tại
6. Cân nhắc tích hợp ClamAV nếu cần quét virus thật cho file upload
