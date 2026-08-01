const bcrypt = require('bcrypt');
const UserModel = require('../models/user.model');
const AdminModel = require('../models/admin.model');
const RefreshTokenModel = require('../models/refreshToken.model');
const { signAccessToken, generateRefreshTokenRaw, hashToken } = require('../utils/jwt');
const config = require('../config/config');
const { logAction } = require('../utils/logger');

const ACCESS_COOKIE = 'admin_access_token';
const REFRESH_COOKIE = 'admin_refresh_token';

function cookieOpts(maxAge, restrictPath) {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: restrictPath,
    maxAge,
  };
}

// Đăng nhập trang quản trị. Với tài khoản không phải admin: trả 404 (giống route không tồn tại)
// để không cho biết đây là cổng đăng nhập quản trị.
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user || user.role !== 'admin') {
      // Cố tình KHÔNG phân biệt "sai mật khẩu" và "không phải admin" — tránh dò tài khoản
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang.' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
    }

    const locked = await UserModel.isCurrentlyLocked(user);
    if (locked) {
      return res.status(429).json({ success: false, message: 'Tài khoản tạm khóa do đăng nhập sai nhiều lần.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const result = await UserModel.registerFailedLogin(user.id, config.loginSecurity.maxAttempts, config.loginSecurity.lockMinutes);
      await logAction(user.id, 'admin_login_failed', result.locked ? 'account_locked' : '', req.ip);
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang.' });
    }

    const permissionLevel = await AdminModel.getPermissionLevel(user.id);
    if (!permissionLevel) {
      // role = admin nhưng chưa có bản ghi phân quyền -> coi như không phải admin hợp lệ
      return res.status(404).json({ success: false, message: 'Không tìm thấy trang.' });
    }

    await UserModel.resetFailedLogins(user.id);

    const accessToken = signAccessToken({ id: user.id, role: user.role, panel: 'admin' });
    const refreshRaw = generateRefreshTokenRaw();
    const refreshHash = hashToken(refreshRaw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // phiên admin ngắn hơn user thường

    await RefreshTokenModel.create({
      userId: user.id, tokenHash: refreshHash,
      userAgent: req.headers['user-agent'], ipAddress: req.ip, expiresAt,
    });

    res.cookie(ACCESS_COOKIE, accessToken, cookieOpts(15 * 60 * 1000, `/${config.adminPanel.path}`));
    res.cookie(REFRESH_COOKIE, refreshRaw, cookieOpts(7 * 24 * 60 * 60 * 1000, `/${config.adminPanel.path}`));

    await logAction(user.id, 'admin_login_success', `permission=${permissionLevel}`, req.ip);

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id, fullName: user.full_name, username: user.username,
        email: user.email, permissionLevel,
      },
    });
  } catch (err) { next(err); }
};

exports.logout = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) await RefreshTokenModel.revokeByHash(hashToken(rawToken));
  res.clearCookie(ACCESS_COOKIE, { path: `/${config.adminPanel.path}` });
  res.clearCookie(REFRESH_COOKIE, { path: `/${config.adminPanel.path}` });
  if (req.user) await logAction(req.user.id, 'admin_logout', '', req.ip);
  res.json({ success: true, message: 'Đã đăng xuất.' });
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user, permissionLevel: req.adminPermission });
};

module.exports.ACCESS_COOKIE = ACCESS_COOKIE;
module.exports.REFRESH_COOKIE = REFRESH_COOKIE;
