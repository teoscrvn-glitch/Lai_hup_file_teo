const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMin * 60 * 1000,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // giới hạn login/register để chống brute-force
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.' },
});

const downloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn tải quá nhanh. Vui lòng thử lại sau.' },
});

module.exports = { globalLimiter, authLimiter, downloadLimiter };
