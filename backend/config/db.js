const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-b4e858-nooblemon3030-8526.aivencloud.com',
  port: process.env.DB_PORT || 23993,
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD, // Nhớ chắc chắn đã điền DB_PASSWORD trên Render
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ssl: {
    rejectUnauthorized: false
  }
});

// Sanity check on boot
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[DB] Kết nối MySQL thành công.');
  } catch (err) {
    console.error('[DB] Không thể kết nối MySQL:', err);
    process.exit(1);
  }
})();

module.exports = pool;

