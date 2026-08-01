const { verifyAccessToken } = require('../utils/jwt');
const UserModel = require('../models/user.model');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return req.cookies?.access_token || req.cookies?.admin_access_token || null;
}

// Bắt buộc đăng nhập — token không hợp lệ/hết hạn => 401 rõ ràng để frontend tự động
// gọi /api/auth/refresh hoặc logout (không giữ phiên "treo" với token chết).
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Bạn chưa đăng nhập.' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      return res.status(401).json({ success: false, code, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, code: 'USER_NOT_FOUND', message: 'Tài khoản không tồn tại.' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, code: 'BANNED', message: 'Tài khoản đã bị khóa.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, code: 'AUTH_ERROR', message: 'Xác thực thất bại.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập.' });
  }
  next();
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = verifyAccessToken(token);
    const user = await UserModel.findById(decoded.id);
    if (user && user.status !== 'banned') req.user = user;
    next();
  } catch {
    next();
  }
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
