const db = require('../config/db');

const DownloadTokenModel = {
  async create({ tokenHash, userId, fileId, ipAddress, expiresAt }) {
    const [result] = await db.query(
      `INSERT INTO download_tokens (token_hash, user_id, file_id, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [tokenHash, userId, fileId, ipAddress || null, expiresAt]
    );
    return result.insertId;
  },

  async findValidByHash(tokenHash) {
    const [rows] = await db.query(
      `SELECT * FROM download_tokens
       WHERE token_hash = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async markUsed(id) {
    await db.query('UPDATE download_tokens SET used = 1, used_at = NOW() WHERE id = ?', [id]);
  },

  async cleanupExpired() {
    await db.query('DELETE FROM download_tokens WHERE expires_at <= NOW() AND used = 0');
  },
};

module.exports = DownloadTokenModel;
