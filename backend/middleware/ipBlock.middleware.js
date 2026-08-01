const config = require('../config/config');
const BlockedIpModel = require('../models/blockedIp.model');
const { logAction } = require('../utils/logger');

// Đếm request theo IP trong bộ nhớ (đủ cho 1 process; nếu scale nhiều instance,
// thay bằng Redis INCR + EXPIRE để đếm dùng chung).
const requestCounts = new Map(); // ip -> { count, windowStart }

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts.entries()) {
    if (now - entry.windowStart > config.ipBlock.windowMin * 60 * 1000) {
      requestCounts.delete(ip);
    }
  }
}, 60 * 1000).unref();

async function ipBlockMiddleware(req, res, next) {
  const ip = req.ip;

  try {
    const blocked = await BlockedIpModel.isBlocked(ip);
    if (blocked) {
      return res.status(429).json({ success: false, message: 'IP của bạn tạm thời bị chặn do gửi quá nhiều yêu cầu.' });
    }
  } catch (err) {
    // Nếu DB lỗi, không chặn cứng luồng chính — chỉ log và tiếp tục (fail-open cho tầng này,
    // vì rate-limit middleware ở tầng khác vẫn hoạt động độc lập).
    console.error('[IPBlock] Lỗi kiểm tra blocked_ips:', err.message);
  }

  const now = Date.now();
  const windowMs = config.ipBlock.windowMin * 60 * 1000;
  const entry = requestCounts.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    requestCounts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
    if (entry.count > config.ipBlock.threshold) {
      requestCounts.delete(ip);
      try {
        await BlockedIpModel.block(ip, 'Vượt ngưỡng request/phút', config.ipBlock.blockMinutes);
        await logAction(null, 'auto_block_ip', `ip=${ip} count=${entry.count}`, ip);
      } catch (err) {
        console.error('[IPBlock] Lỗi ghi blocked_ips:', err.message);
      }
      return res.status(429).json({ success: false, message: 'Bạn đã gửi quá nhiều yêu cầu. IP tạm thời bị chặn.' });
    }
  }

  next();
}

module.exports = ipBlockMiddleware;
