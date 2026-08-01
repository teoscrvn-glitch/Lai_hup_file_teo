const db = require('../config/db');
const FileModel = require('../models/file.model');
const { logAction } = require('../utils/logger');

// ===== COMMENTS (chỉ người đã mua/sở hữu file mới được bình luận) =====
exports.listComments = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, u.username, u.avatar
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.file_id = ? ORDER BY c.created_at ASC`,
      [req.params.fileId]
    );
    res.json({ success: true, comments: rows });
  } catch (err) { next(err); }
};

exports.postComment = async (req, res, next) => {
  try {
    const { content, parentId } = req.body;
    const fileId = req.params.fileId;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
    }

    const file = await FileModel.findById(fileId);
    if (!file) return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });

    // File miễn phí: ai cũng bình luận được. File trả phí: phải sở hữu.
    if (file.file_type === 'paid') {
      const owned = await FileModel.userOwnsFile(req.user.id, fileId);
      if (!owned && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn cần mua file này trước khi bình luận.' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO comments (file_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [fileId, req.user.id, parentId || null, content.trim()]
    );
    await logAction(req.user.id, 'post_comment', `file_id=${fileId}`, req.ip);
    res.status(201).json({ success: true, commentId: result.insertId });
  } catch (err) { next(err); }
};

// ===== RATINGS (chỉ người đã mua mới được đánh giá file trả phí) =====
exports.rateFile = async (req, res, next) => {
  try {
    const { stars } = req.body;
    const fileId = req.params.fileId;
    const s = parseInt(stars, 10);
    if (isNaN(s) || s < 1 || s > 5) {
      return res.status(400).json({ success: false, message: 'Số sao phải từ 1 đến 5.' });
    }

    const file = await FileModel.findById(fileId);
    if (!file) return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });
    if (file.file_type === 'paid') {
      const owned = await FileModel.userOwnsFile(req.user.id, fileId);
      if (!owned) return res.status(403).json({ success: false, message: 'Bạn cần mua file này trước khi đánh giá.' });
    }

    await db.query(
      `INSERT INTO ratings (file_id, user_id, stars) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stars = VALUES(stars)`,
      [fileId, req.user.id, s]
    );

    const [[agg]] = await db.query(
      'SELECT AVG(stars) AS avgStars, COUNT(*) AS count FROM ratings WHERE file_id = ?',
      [fileId]
    );
    await db.query('UPDATE files SET rating_avg = ?, rating_count = ? WHERE id = ?', [
      Number(agg.avgStars).toFixed(2), agg.count, fileId,
    ]);

    res.json({ success: true, message: 'Đã ghi nhận đánh giá.', ratingAvg: agg.avgStars, ratingCount: agg.count });
  } catch (err) { next(err); }
};

// ===== NOTIFICATIONS =====
exports.myNotifications = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ success: true, notifications: rows });
  } catch (err) { next(err); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};
