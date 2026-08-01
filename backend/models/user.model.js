const db = require('../config/db');

const UserModel = {
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findByUsername(username) {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT id, full_name, username, email, avatar, points, role, status, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ fullName, username, email, passwordHash }) {
    const [result] = await db.query(
      `INSERT INTO users (full_name, username, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [fullName, username, email, passwordHash]
    );
    return result.insertId;
  },

  async updatePassword(userId, passwordHash) {
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  },

  // ----- Chống brute-force đăng nhập -----
  async registerFailedLogin(userId, maxAttempts, lockMinutes) {
    const [[user]] = await db.query('SELECT failed_login_attempts FROM users WHERE id = ?', [userId]);
    const attempts = (user?.failed_login_attempts || 0) + 1;

    if (attempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      await db.query(
        'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [attempts, lockedUntil, userId]
      );
      return { locked: true, lockedUntil };
    }
    await db.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, userId]);
    return { locked: false, attemptsLeft: maxAttempts - attempts };
  },

  async resetFailedLogins(userId) {
    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [userId]);
  },

  async isCurrentlyLocked(user) {
    return !!(user.locked_until && new Date(user.locked_until) > new Date());
  },

  async updateAvatar(userId, avatarPath) {
    await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, userId]);
  },

  async adjustPoints(userId, amount, reason, referenceId, connection = db) {
    // amount có thể âm (trừ điểm) hoặc dương (cộng điểm)
    await connection.query('UPDATE users SET points = points + ? WHERE id = ?', [amount, userId]);
    const [[user]] = await connection.query('SELECT points FROM users WHERE id = ?', [userId]);
    await connection.query(
      `INSERT INTO points_history (user_id, amount, reason, reference_id, balance_after)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, amount, reason, referenceId || null, user.points]
    );
    return user.points;
  },
};

module.exports = UserModel;
