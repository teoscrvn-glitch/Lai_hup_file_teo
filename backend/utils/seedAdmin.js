require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

(async () => {
  try {
    const email = process.env.SEED_ADMIN_EMAIL;
    const username = process.env.SEED_ADMIN_USERNAME;
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!email || !username || !password) {
      console.error('Thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD trong .env');
      process.exit(1);
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length > 0) {
      console.log('Tài khoản admin đã tồn tại, bỏ qua.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (full_name, username, email, password_hash, role)
       VALUES ('Administrator', ?, ?, ?, 'admin')`,
      [username, email, passwordHash]
    );
    await db.query('INSERT INTO admins (user_id, permission_level) VALUES (?, ?)', [result.insertId, 'super']);

    console.log(`Đã tạo tài khoản admin: ${email} — hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed admin thất bại:', err.message);
    process.exit(1);
  }
})();
