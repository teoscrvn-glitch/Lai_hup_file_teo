const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const logFile = path.join(__dirname, '..', 'logs', 'app.log');

async function logAction(userId, action, detail = '', ipAddress = '', severity = 'info') {
  const line = `[${new Date().toISOString()}] [${severity}] user=${userId || 'guest'} action=${action} detail=${detail} ip=${ipAddress}\n`;
  fs.appendFile(logFile, line, () => {});

  try {
    await db.query(
      'INSERT INTO logs (user_id, action, severity, detail, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId || null, action, severity, detail, ipAddress]
    );
  } catch (err) {
    console.error('[Logger] Ghi log DB thất bại:', err.message);
  }
}

module.exports = { logAction };
