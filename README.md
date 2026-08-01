# Lại Húp File

Website chia sẻ & bán source code, tool, app, macro, template, AI, Roblox, Free Fire, file học tập.
Hỗ trợ mua bằng tiền (chuyển khoản QR) và mua bằng điểm (kiếm điểm qua đăng video).

Stack: Node.js + Express + MySQL + JWT + bcrypt + Multer, chạy trên VPS Ubuntu với Nginx + Let's Encrypt.
Không dùng Firebase / Supabase / BaaS.

## Trạng thái: PART 1 + PART 2 — đã hoàn thành

Part 1:
- Cấu trúc project đầy đủ (backend/frontend/database/deploy)
- `database/database.sql` — toàn bộ 17 bảng theo đúng spec
- Cấu hình bảo mật cơ bản: Helmet, CORS, rate limit, HPP, cookie httpOnly
- Module xác thực hoàn chỉnh: đăng ký (validate + captcha check), đăng nhập (JWT + remember),
  đăng xuất, đổi mật khẩu, lấy thông tin cá nhân
- Script seed tài khoản admin đầu tiên
- Nginx config + script cài đặt/deploy VPS Ubuntu

Part 2:
- API files: CRUD (admin), tìm kiếm/lọc (fulltext, danh mục, tag, giá, sắp xếp), upload thumbnail + file trả phí (Multer, MIME validation),
  tải file có kiểm tra quyền (miễn phí trực tiếp/vượt link, trả phí bắt buộc đăng nhập + sở hữu), yêu thích
- API danh mục + tag (CRUD danh mục, tự tạo tag khi thêm file)
- API orders + payments: tạo đơn mua bằng tiền (mã đơn LHF-XXXXXXXX, hết hạn 7 ngày, QR VietQR), mua bằng điểm (transaction có khóa hàng chống race condition),
  admin duyệt/từ chối thanh toán, tự động expire đơn quá hạn
- API videos: gửi video xét duyệt, admin duyệt/từ chối (có lý do), **cộng điểm theo mốc chênh lệch** (không cộng lại từ đầu) qua bảng `video_rewards`
- API comments (chỉ người sở hữu file trả phí mới bình luận được), ratings (1-5 sao, tự tính trung bình), notifications (đọc/đánh dấu đã đọc)

Part 3 (Bảo mật nâng cao):
- Trang Admin tách biệt hoàn toàn: mount tại đường dẫn bí mật (`ADMIN_PANEL_PATH`), cookie/login riêng, user thường truy cập → 404 (ẩn sự tồn tại)
- Phân quyền 3 cấp Super Admin/Admin/Moderator, mọi thao tác admin đều ghi log
- Access token JWT ngắn hạn (15 phút) + Refresh token (random, hash SHA-256, thu hồi được, rotation)
- Chống brute-force: khóa tài khoản sau N lần sai mật khẩu; chặn IP tự động khi vượt ngưỡng request
- Link tải file trả phí: token ngẫu nhiên, hết hạn 5 phút, dùng 1 lần — không đoán được URL
- Kiểm tra chữ ký nhị phân thật (magic bytes) cho file upload — chống đổi đuôi file
- Helmet + Nginx security headers (2 lớp), CORS chặt, ẩn `X-Powered-By`/`server_tokens`, gzip, cache tĩnh
- Chi tiết đầy đủ + checklist đối chiếu từng yêu cầu: xem `SECURITY.md`

## Còn thiếu (Part 4)

- Trang Admin Dashboard tổng hợp (doanh thu, thống kê, quản lý user, nhật ký log)
- Toàn bộ giao diện frontend (HTML/CSS/JS + Tailwind, dark mode, skeleton loading, toast, popup)
- Captcha thật (hCaptcha/reCAPTCHA) — hiện mới có chỗ chờ token
- Quản lý user (khóa/mở tài khoản) từ phía admin

## Cài đặt nhanh (VPS Ubuntu)

```bash
git clone <repo-url> lai-hup-file
cd lai-hup-file/deploy
chmod +x install.sh run.sh
./install.sh
```

Sau khi `install.sh` chạy xong:

```bash
cd ../backend
nano .env                 # điền DB, JWT_SECRET, thông tin ngân hàng thật
npm run seed:admin        # tạo tài khoản admin đầu tiên
cd ../deploy && ./run.sh  # chạy server bằng PM2
```

Cấu hình Nginx + SSL: xem hướng dẫn cuối `install.sh`.

## Cấu trúc thư mục

```
lai-hup-file/
├── backend/
│   ├── config/        # db.js, config.js
│   ├── controllers/   # xử lý logic từng route
│   ├── routes/        # định nghĩa endpoint
│   ├── models/        # truy vấn SQL
│   ├── middleware/     # auth, rate limit, error handler
│   ├── services/       # nghiệp vụ phức tạp (points, payment...)
│   ├── utils/          # helper (jwt, logger, order code...)
│   ├── uploads/         # file lưu trên VPS (public/ + paid/, paid không public)
│   ├── logs/
│   ├── server.js
│   └── package.json
├── frontend/            # HTML/CSS/JS thuần (thêm ở part sau)
├── database/
│   └── database.sql
└── deploy/
    ├── nginx.conf
    ├── install.sh
    └── run.sh
```

## Bảo mật đã áp dụng

- Mật khẩu: bcrypt, 12 salt rounds
- JWT ký với secret riêng, cookie httpOnly + sameSite strict
- Rate limit riêng cho auth (chống brute-force) và download
- Helmet (security headers), HPP (chống HTTP param pollution)
- express-validator cho input đăng ký
- File trả phí KHÔNG serve qua static route — bắt buộc qua controller kiểm tra quyền sở hữu
  (sẽ hoàn thiện ở Part 2)
- Mọi thao tác quan trọng đều ghi log vào bảng `logs` + file `logs/app.log`
