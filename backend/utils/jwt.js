const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/config');

// ===== Access token: NGẮN HẠN (15 phút mặc định) =====
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

// ===== Refresh token: random string, KHÔNG phải JWT — lưu hash trong DB để có thể thu hồi =====
function generateRefreshTokenRaw() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshTokenRaw,
  generateSecureRandomToken: generateRefreshTokenRaw, // alias dùng chung cho download token, v.v.
  hashToken,
  // Alias giữ tương thích ngược cho code Part 1/2 cũ (login/register controller)
  signToken: signAccessToken,
  verifyToken: verifyAccessToken,
};
