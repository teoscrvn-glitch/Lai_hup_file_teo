const db = require('../config/db');

const OrderModel = {
  async create({ orderCode, userId, fileId, amount, expiresAt }, connection = db) {
    const [result] = await connection.query(
      `INSERT INTO orders (order_code, user_id, file_id, amount, status, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [orderCode, userId, fileId, amount, expiresAt]
    );
    return result.insertId;
  },

  async findByCode(orderCode) {
    const [rows] = await db.query('SELECT * FROM orders WHERE order_code = ? LIMIT 1', [orderCode]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findPendingByUserAndFile(userId, fileId) {
    const [rows] = await db.query(
      `SELECT * FROM orders WHERE user_id = ? AND file_id = ? AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
      [userId, fileId]
    );
    return rows[0] || null;
  },

  async listByUser(userId) {
    const [rows] = await db.query(
      `SELECT o.*, f.title AS file_title, f.slug AS file_slug, p.status AS payment_status
       FROM orders o
       JOIN files f ON o.file_id = f.id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.user_id = ? ORDER BY o.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async listAll({ status, page = 1, limit = 30 }) {
    const where = [];
    const params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }
    const offset = (page - 1) * limit;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT o.*, u.username, u.email, f.title AS file_title, p.status AS payment_status, p.id AS payment_id
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN files f ON o.file_id = f.id
       LEFT JOIN payments p ON p.order_id = o.id
       ${whereSql}
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  },

  async markStatus(id, status, connection = db) {
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  },

  async expireOldOrders() {
    await db.query(`UPDATE orders SET status = 'expired' WHERE status = 'pending' AND expires_at <= NOW()`);
  },
};

module.exports = OrderModel;
