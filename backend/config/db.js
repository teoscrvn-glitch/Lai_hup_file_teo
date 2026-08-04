const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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

