const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');
const RefreshTokenModel = require('../models/refreshToken.model');
const { signAccessToken, generateRefreshTokenRaw, hashToken } = require('../utils/jwt');
const config = require('../config/config');
const { logAction } = require('../utils/logger');

const SALT_ROUNDS = 12;
const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // khớp JWT_EXPIRES_IN mặc định
  };
}

function refreshCookieOptions(remember) {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    path: '/api/auth', // chỉ gửi cookie này tới route refresh/logout, giảm bề mặt tấn công
    maxAge: (remember ? 90 : 30) * 24 * 60 * 60 * 1000,
  };
}

async function issueSession(res, user, remember, req) {
  const accessToken = signAccessToken({ id: user.id, role: user.role });

  const refreshRaw = generateRefreshTokenRaw();
  const refreshHash = hashToken(refreshRaw);
  const expiresAt = new Date(Date.now() + (remember ? 90 : 30) * 24 * 60 * 60 * 1000);

  await RefreshTokenModel.create({
    userId: user.id,
    tokenHash: refreshHash,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    expiresAt,
  });

  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshRaw, refreshCookieOptions(remember));

  return accessToken;
}

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { fullName, username, email, password, confirmPassword, captchaToken } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp.' });
    }

    // TODO: xác thực captchaToken với dịch vụ captcha thật (hCaptcha/reCAPTCHA) trước khi lên production
    if (!captchaToken) {
      return res.status(400).json({ success: false, message: 'Vui lòng xác thực captcha.' });
    }

    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng.' });
    }
    const existingUsername = await UserModel.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await UserModel.create({ fullName, username, email, passwordHash });

    await logAction(userId, 'register', `username=${username}`, req.ip);

    const accessToken = await issueSession(res, { id: userId, role: 'user' }, false, req);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công.',
      accessToken,
      user: { id: userId, fullName, username, email, role: 'user' },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
    }

    const locked = await UserModel.isCurrentlyLocked(user);
    if (locked) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Thử lại sau ${minutesLeft} phút.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const result = await UserModel.registerFailedLogin(user.id, config.loginSecurity.maxAttempts, config.loginSecurity.lockMinutes);
      await logAction(user.id, 'login_failed', result.locked ? 'account_locked' : `attempts_left=${result.attemptsLeft}`, req.ip);

      if (result.locked) {
        return res.status(429).json({
          success: false,
          message: `Sai mật khẩu quá nhiều lần. Tài khoản tạm khóa ${config.loginSecurity.lockMinutes} phút.`,
        });
      }
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    await UserModel.resetFailedLogins(user.id);
    const accessToken = await issueSession(res, user, !!remember, req);
    await logAction(user.id, 'login_success', '', req.ip);

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      accessToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        points: user.points,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Cấp access token mới từ refresh token hợp lệ (rotation: thu hồi refresh cũ, phát refresh mới)
exports.refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      return res.status(401).json({ success: false, message: 'Không tìm thấy phiên đăng nhập.' });
    }

    const tokenHash = hashToken(rawToken);
    const stored = await RefreshTokenModel.findValidByHash(tokenHash);
    if (!stored) {
      res.clearCookie(ACCESS_COOKIE);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    const user = await UserModel.findById(stored.user_id);
    if (!user || user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Tài khoản không khả dụng.' });
    }

    // Token rotation: thu hồi refresh token cũ ngay khi dùng, phát token mới
    await RefreshTokenModel.revokeByHash(tokenHash);
    const remember = (new Date(stored.expires_at) - new Date(stored.created_at)) > 60 * 24 * 60 * 60 * 1000;
    const accessToken = await issueSession(res, user, remember, req);

    res.json({ success: true, accessToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) {
    await RefreshTokenModel.revokeByHash(hashToken(rawToken));
  }
  res.clearCookie(ACCESS_COOKIE);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  if (req.user) await logAction(req.user.id, 'logout', '', req.ip);
  res.json({ success: true, message: 'Đã đăng xuất.' });
};

// Đăng xuất khỏi TẤT CẢ thiết bị (thu hồi mọi refresh token của user)
exports.logoutAll = async (req, res, next) => {
  try {
    await RefreshTokenModel.revokeAllForUser(req.user.id);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    await logAction(req.user.id, 'logout_all_devices', '', req.ip);
    res.json({ success: true, message: 'Đã đăng xuất khỏi tất cả thiết bị.' });
  } catch (err) { next(err); }
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const fullUser = await UserModel.findByEmail(req.user.email); // cần password_hash
    const isMatch = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await UserModel.updatePassword(req.user.id, newHash);
    // Đổi mật khẩu xong -> thu hồi mọi refresh token cũ, buộc đăng nhập lại trên các thiết bị khác
    await RefreshTokenModel.revokeAllForUser(req.user.id);
    await logAction(req.user.id, 'change_password', '', req.ip);
    res.json({ success: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.' });
  } catch (err) {
    next(err);
  }
};
