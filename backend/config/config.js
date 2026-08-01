require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m', // access token NGẮN HẠN — refresh token lo phần "remember"
    rememberExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },

  refreshToken: {
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    rememberExpiresIn: process.env.REFRESH_TOKEN_REMEMBER_EXPIRES_IN || '90d',
  },

  // Trang quản trị: đường dẫn bí mật, KHÔNG lộ trong frontend, đổi giá trị này trong .env
  adminPanel: {
    path: process.env.ADMIN_PANEL_PATH || 'admin-panel-x7q9k2',
  },

  download: {
    tokenExpiresMinutes: parseInt(process.env.DOWNLOAD_TOKEN_EXPIRES_MIN || '5', 10),
  },

  loginSecurity: {
    maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES || '15', 10),
  },

  ipBlock: {
    // Nếu 1 IP vượt quá `threshold` request trong `windowMin` phút -> block `blockMinutes` phút
    windowMin: parseInt(process.env.IP_BLOCK_WINDOW_MIN || '1', 10),
    threshold: parseInt(process.env.IP_BLOCK_THRESHOLD || '120', 10),
    blockMinutes: parseInt(process.env.IP_BLOCK_MINUTES || '30', 10),
  },

  upload: {
    maxSizeMB: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '200', 10),
    dir: process.env.UPLOAD_DIR || 'uploads',
    allowedMimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/x-7z-compressed',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
    ],
  },

  bank: {
    name: process.env.BANK_NAME,
    accountName: process.env.BANK_ACCOUNT_NAME,
    accountNumber: process.env.BANK_ACCOUNT_NUMBER,
  },

  rateLimit: {
    windowMin: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  points: {
    // Mốc view => tổng điểm tích lũy tại mốc đó.
    // Khi duyệt video, hệ thống chỉ cộng phần chênh lệch so với mốc cao nhất đã nhận trước đó.
    milestones: [
      { views: 1000, points: 10000 },
      { views: 3000, points: 30000 },
      { views: 5000, points: 50000 },
      { views: 10000, points: 100000 },
      { views: 20000, points: 220000 },
      { views: 30000, points: 350000 },
      { views: 50000, points: 650000 },
      { views: 100000, points: 1500000 },
    ],
  },

  order: {
    expireHours: 168, // 7 ngày
  },
};
