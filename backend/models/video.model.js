const db = require('../config/db');

const VideoModel = {
  async create({ userId, fileId, videoLink, platform, declaredViews, note }) {
    const [result] = await db.query(
      `INSERT INTO videos (user_id, file_id, video_link, platform, declared_views, note, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, fileId || null, videoLink, platform, declaredViews, note || null]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM videos WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async listByUser(userId) {
    const [rows] = await db.query(
      `SELECT v.*, f.title AS file_title FROM videos v
       LEFT JOIN files f ON v.file_id = f.id
       WHERE v.user_id = ? ORDER BY v.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async listAll({ status, page = 1, limit = 30 }) {
    const where = [];
    const params = [];
    if (status) { where.push('v.status = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      `SELECT v.*, u.username, u.email, f.title AS file_title
       FROM videos v JOIN users u ON v.user_id = u.id
       LEFT JOIN files f ON v.file_id = f.id
       ${whereSql} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  },

  // Mốc điểm cao nhất đã được cộng cho video này (để tính chênh lệch khi duyệt lại ở view cao hơn)
  async highestMilestoneAwarded(videoId) {
    const [rows] = await db.query(
      `SELECT COALESCE(MAX(milestone_views), 0) AS maxMilestone, COALESCE(SUM(points_awarded), 0) AS totalAwarded
       FROM video_rewards WHERE video_id = ?`,
      [videoId]
    );
    return rows[0];
  },

  async recordReward(videoId, milestoneViews, pointsAwarded, connection = db) {
    await connection.query(
      'INSERT INTO video_rewards (video_id, milestone_views, points_awarded) VALUES (?, ?, ?)',
      [videoId, milestoneViews, pointsAwarded]
    );
  },

  async setDeclaredViews(id, views) {
    await db.query('UPDATE videos SET declared_views = ? WHERE id = ?', [views, id]);
  },

  async approve(id) {
    await db.query(`UPDATE videos SET status = 'approved', reviewed_at = NOW() WHERE id = ?`, [id]);
  },

  async reject(id, reason) {
    await db.query(
      `UPDATE videos SET status = 'rejected', reject_reason = ?, reviewed_at = NOW() WHERE id = ?`,
      [reason, id]
    );
  },

  async setReviewer(id, adminId) {
    await db.query('UPDATE videos SET reviewed_by = ? WHERE id = ?', [adminId, id]);
  },

  async countApprovedByUser(userId) {
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM videos WHERE user_id = ? AND status = 'approved'`,
      [userId]
    );
    return count;
  },
};

module.exports = VideoModel;
