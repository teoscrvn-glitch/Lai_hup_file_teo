const db = require('../config/db');
const AdminModel = require('../models/admin.model');
const BlockedIpModel = require('../models/blockedIp.model');
const RefreshTokenModel = require('../models/refreshToken.model');
const { logAction } = require('../utils/logger');

// ===== DASHBOARD =====
exports.dashboard = async (req, res, next) => {
  try {
    const [[userCount]] = await db.query('SELECT COUNT(*) AS c FROM users');
    const [[fileCount]] = await db.query('SELECT COUNT(*) AS c FROM files');
    const [[pendingOrders]] = await db.query(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`);
    const [[pendingVideos]] = await db.query(`SELECT COUNT(*) AS c FROM videos WHERE status = 'pending'`);
    const [[revenueToday]] = await db.query(
      `SELECT COALESCE(SUM(o.amount), 0) AS total FROM orders o
       WHERE o.status = 'paid' AND DATE(o.updated_at) = CURDATE()`
    );
    const [[revenueMonth]] = await db.query(
      `SELECT COALESCE(SUM(o.amount), 0) AS total FROM orders o
       WHERE o.status = 'paid' AND YEAR(o.updated_at) = YEAR(CURDATE()) AND MONTH(o.updated_at) = MONTH(CURDATE())`
    );
    const [[revenueTotal]] = await db.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'paid'`);
    const [topFiles] = await db.query(
      `SELECT id, title, downloads, purchases, views FROM files ORDER BY downloads DESC LIMIT 5`
    );
    const [recentLogs] = await db.query(
      `SELECT l.*, u.username FROM logs l LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      stats: {
        userCount: userCount.c,
        fileCount: fileCount.c,
        pendingOrders: pendingOrders.c,
        pendingVideos: pendingVideos.c,
        revenueToday: revenueToday.total,
        revenueMonth: revenueMonth.total,
        revenueTotal: revenueTotal.total,
      },
      topFiles,
      recentLogs,
    });
  } catch (err) { next(err); }
};

// ===== QUẢN LÝ NGƯỜI DÙNG =====
exports.listUsers = async (req, res, next) => {
  try {
    const { q, status, page = 1, limit = 30 } = req.query;
    const where = [];
    const params = [];
    if (q) { where.push('(username LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    if (status) { where.push('status = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [rows] = await db.query(
      `SELECT id, full_name, username, email, points, role, status, created_at
       FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
};

exports.setUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' | 'banned'
    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    if (status === 'banned') {
      await RefreshTokenModel.revokeAllForUser(req.params.id); // đá user ra khỏi mọi phiên đang đăng nhập
    }
    await logAction(req.user.id, 'set_user_status', `target_user=${req.params.id} status=${status}`, req.ip);
    res.json({ success: true, message: 'Đã cập nhật trạng thái tài khoản.' });
  } catch (err) { next(err); }
};

exports.adjustUserPoints = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt === 0) {
      return res.status(400).json({ success: false, message: 'Số điểm không hợp lệ.' });
    }
    const UserModel = require('../models/user.model');
    const newBalance = await UserModel.adjustPoints(req.params.id, amt, 'admin_adjust', null);
    await logAction(req.user.id, 'adjust_user_points', `target_user=${req.params.id} amount=${amt} reason=${reason || ''}`, req.ip);
    res.json({ success: true, message: 'Đã điều chỉnh điểm.', newBalance });
  } catch (err) { next(err); }
};

// ===== PHÂN QUYỀN ADMIN (chỉ Super Admin) =====
exports.listAdmins = async (req, res, next) => {
  try {
    res.json({ success: true, admins: await AdminModel.listAdmins() });
  } catch (err) { next(err); }
};

exports.grantAdmin = async (req, res, next) => {
  try {
    const { userId, permissionLevel } = req.body; // 'super' | 'admin' | 'moderator'
    if (!['super', 'admin', 'moderator'].includes(permissionLevel)) {
      return res.status(400).json({ success: false, message: 'Mức quyền không hợp lệ.' });
    }
    await db.query(`UPDATE users SET role = 'admin' WHERE id = ?`, [userId]);
    await AdminModel.setPermissionLevel(userId, permissionLevel);
    await logAction(req.user.id, 'grant_admin', `target_user=${userId} level=${permissionLevel}`, req.ip);
    res.json({ success: true, message: 'Đã cấp quyền quản trị.' });
  } catch (err) { next(err); }
};

exports.revokeAdmin = async (req, res, next) => {
  try {
    if (Number(req.params.userId) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Không thể tự thu hồi quyền của chính mình.' });
    }
    await AdminModel.remove(req.params.userId);
    await db.query(`UPDATE users SET role = 'user' WHERE id = ?`, [req.params.userId]);
    await RefreshTokenModel.revokeAllForUser(req.params.userId);
    await logAction(req.user.id, 'revoke_admin', `target_user=${req.params.userId}`, req.ip);
    res.json({ success: true, message: 'Đã thu hồi quyền quản trị.' });
  } catch (err) { next(err); }
};

// ===== NHẬT KÝ HỆ THỐNG =====
exports.listLogs = async (req, res, next) => {
  try {
    const { userId, action, severity, page = 1, limit = 50 } = req.query;
    const where = [];
    const params = [];
    if (userId) { where.push('l.user_id = ?'); params.push(userId); }
    if (action) { where.push('l.action LIKE ?'); params.push(`%${action}%`); }
    if (severity) { where.push('l.severity = ?'); params.push(severity); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [rows] = await db.query(
      `SELECT l.*, u.username FROM logs l LEFT JOIN users u ON l.user_id = u.id
       ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );
    res.json({ success: true, logs: rows });
  } catch (err) { next(err); }
};

// ===== IP BỊ CHẶN (chống DDoS / lạm dụng API) =====
exports.listBlockedIps = async (req, res, next) => {
  try {
    res.json({ success: true, blockedIps: await BlockedIpModel.listActive() });
  } catch (err) { next(err); }
};

exports.unblockIp = async (req, res, next) => {
  try {
    await BlockedIpModel.unblock(req.params.ip);
    await logAction(req.user.id, 'unblock_ip', `ip=${req.params.ip}`, req.ip);
    res.json({ success: true, message: 'Đã gỡ chặn IP.' });
  } catch (err) { next(err); }
};

exports.blockIp = async (req, res, next) => {
  try {
    const { ip, minutes, reason } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'Thiếu địa chỉ IP.' });
    await BlockedIpModel.block(ip, reason || 'Chặn thủ công bởi admin', minutes || 60);
    await logAction(req.user.id, 'manual_block_ip', `ip=${ip}`, req.ip);
    res.json({ success: true, message: 'Đã chặn IP.' });
  } catch (err) { next(err); }
};
