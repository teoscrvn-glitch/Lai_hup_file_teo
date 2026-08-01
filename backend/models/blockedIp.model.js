const db = require('../config/db');

const BlockedIpModel = {
  async isBlocked(ip) {
    const [rows] = await db.query(
      'SELECT * FROM blocked_ips WHERE ip_address = ? AND blocked_until > NOW() LIMIT 1',
      [ip]
    );
    return rows[0] || null;
  },

  async block(ip, reason, minutes) {
    const blockedUntil = new Date(Date.now() + minutes * 60 * 1000);
    await db.query(
      `INSERT INTO blocked_ips (ip_address, reason, blocked_until)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), blocked_until = VALUES(blocked_until)`,
      [ip, reason, blockedUntil]
    );
  },

  async unblock(ip) {
    await db.query('DELETE FROM blocked_ips WHERE ip_address = ?', [ip]);
  },

  async cleanupExpired() {
    await db.query('DELETE FROM blocked_ips WHERE blocked_until <= NOW()');
  },

  async listActive() {
    const [rows] = await db.query('SELECT * FROM blocked_ips WHERE blocked_until > NOW() ORDER BY blocked_until DESC');
    return rows;
  },
};

module.exports = BlockedIpModel;
