require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const path = require('path');

const config = require('./config/config');
const { globalLimiter } = require('./middleware/rateLimiter');
const ipBlockMiddleware = require('./middleware/ipBlock.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const fileRoutes = require('./routes/file.routes');
const taxonomyRoutes = require('./routes/taxonomy.routes');
const orderRoutes = require('./routes/order.routes');
const videoRoutes = require('./routes/video.routes');
const engagementRoutes = require('./routes/engagement.routes');
const downloadRoutes = require('./routes/download.routes');
const adminRoutes = require('./routes/admin.routes'); // mounted tại đường dẫn BÍ MẬT — xem bên dưới

const app = express();

// Không tiết lộ công nghệ backend qua header
app.disable('x-powered-by');
app.set('trust proxy', 1); // đứng sau Nginx — cần để req.ip lấy đúng IP thật (X-Forwarded-For)

// ===== Security middleware =====
app.use(helmet());
app.use(hpp());
app.use(compression()); // gzip response — Brotli nên bật thêm ở tầng Nginx (xem deploy/nginx.conf)
app.use(cors({
  origin: config.env === 'production' ? config.baseUrl : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(ipBlockMiddleware); // chặn IP lạm dụng TRƯỚC khi vào rate-limit chi tiết
app.use(globalLimiter);

// ===== Static files =====
// Ảnh thumbnail, avatar public — được phép truy cập trực tiếp, cache dài hạn (immutable theo tên file random)
app.use('/uploads/public', express.static(path.join(__dirname, 'uploads', 'public'), {
  maxAge: '30d',
  immutable: true,
}));
// LƯU Ý QUAN TRỌNG: uploads/paid/ KHÔNG bao giờ được serve qua static.
// File trả phí chỉ đọc được qua controller (fileController.serveDownloadToken) có kiểm tra
// token tải hợp lệ, thời hạn ngắn, dùng 1 lần. Không có route static nào trỏ tới uploads/paid.
app.use(express.static(path.join(__dirname, '..', 'frontend'), { maxAge: '1h' }));

// ===== API routes công khai =====
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api', taxonomyRoutes);       // /api/categories, /api/tags
app.use('/api/orders', orderRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api', engagementRoutes);     // /api/files/:id/comments, /rate, /api/notifications/*
app.use('/api/download', downloadRoutes); // /api/download/:token — link tải ngắn hạn, dùng 1 lần

// ===== TRANG QUẢN TRỊ — đường dẫn bí mật, đổi trong .env (ADMIN_PANEL_PATH) =====
// KHÔNG có bất kỳ liên kết nào tới đường dẫn này trong frontend người dùng.
// Người dùng thường / chưa đăng nhập truy cập vào đây sẽ nhận 404 (middleware requireAdminPanel).
app.use(`/${config.adminPanel.path}`, adminRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'OK' }));

// ===== Error handling (KHÔNG bao giờ lộ stack trace / thông tin nội bộ ra response) =====
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[Server] Lại Húp File đang chạy tại http://localhost:${config.port} (${config.env})`);
  if (config.env !== 'production') {
    console.log(`[Server] Trang quản trị (dev only, xem log): /${config.adminPanel.path}`);
  }
});
