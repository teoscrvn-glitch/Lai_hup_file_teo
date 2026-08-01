const db = require('../config/db');

const AdminModel = {
  async getPermissionLevel(userId) {
    const [rows] = await db.query('SELECT permission_level FROM admins WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0]?.permission_level || null; // 'super' | 'admin' | 'moderator' | null
  },

  async setPermissionLevel(userId, level) {
    await db.query(
      `INSERT INTO admins (user_id, permission_level) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE permission_level = VALUES(permission_level)`,
      [userId, level]
    );
  },

  async remove(userId) {
    await db.query('DELETE FROM admins WHERE user_id = ?', [userId]);
  },

  async listAdmins() {
    const [rows] = await db.query(
      `SELECT u.id, u.full_name, u.username, u.email, a.permission_level, u.status
       FROM admins a JOIN users u ON a.user_id = u.id
       ORDER BY FIELD(a.permission_level, 'super', 'admin', 'moderator')`
    );
    return rows;
  },
};

module.exports = AdminModel;
