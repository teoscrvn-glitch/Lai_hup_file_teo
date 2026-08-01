const db = require('../config/db');

async function notify(userId, type, title, message) {
  await db.query(
    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
    [userId, type, title, message]
  );
}

module.exports = { notify };
