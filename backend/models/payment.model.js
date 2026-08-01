const db = require('../config/db');

const PaymentModel = {
  async create({ orderId, bankName, accountName, accountNumber, transferContent, qrCodeUrl }, connection = db) {
    const [result] = await connection.query(
      `INSERT INTO payments (order_id, bank_name, account_name, account_number, transfer_content, qr_code_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, bankName, accountName, accountNumber, transferContent, qrCodeUrl]
    );
    return result.insertId;
  },

  async findByOrderId(orderId) {
    const [rows] = await db.query('SELECT * FROM payments WHERE order_id = ? LIMIT 1', [orderId]);
    return rows[0] || null;
  },

  async approve(paymentId, adminId, connection = db) {
    await connection.query(
      `UPDATE payments SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [adminId, paymentId]
    );
  },

  async reject(paymentId, adminId, connection = db) {
    await connection.query(
      `UPDATE payments SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [adminId, paymentId]
    );
  },
};

module.exports = PaymentModel;
