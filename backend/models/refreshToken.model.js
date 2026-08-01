const db = require('../config/db');

const RefreshTokenModel = {
  async create({ userId, tokenHash, userAgent, ipAddress, expiresAt }) {
    const [result] = await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt]
    );
    return result.insertId;
  },

  async findValidByHash(tokenHash) {
    const [rows] = await db.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = ? AND revoked = 0 AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async revokeByHash(tokenHash) {
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [tokenHash]);
  },

  async revokeAllForUser(userId) {
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
  },

  async cleanupExpired() {
    await db.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW() OR revoked = 1');
  },
};

module.exports = RefreshTokenModel;
