const db = require('../config/db');
const VideoModel = require('../models/video.model');
const UserModel = require('../models/user.model');
const { calculateRewardDiff } = require('../services/points.service');
const { notify } = require('../services/notification.service');
const { logAction } = require('../utils/logger');

const PLATFORMS = ['tiktok', 'facebook', 'youtube', 'reels', 'shorts', 'other'];

exports.submit = async (req, res, next) => {
  try {
    const { videoLink, platform, declaredViews, note, fileId } = req.body;
    if (!videoLink || !platform || declaredViews === undefined) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ link video, nền tảng và lượt xem.' });
    }
    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, message: 'Nền tảng không hợp lệ.' });
    }
    const views = parseInt(declaredViews, 10);
    if (isNaN(views) || views < 0) {
      return res.status(400).json({ success: false, message: 'Lượt xem không hợp lệ.' });
    }

    const videoId = await VideoModel.create({
      userId: req.user.id, fileId: fileId || null, videoLink, platform, declaredViews: views, note,
    });

    await logAction(req.user.id, 'submit_video', `video_id=${videoId} views=${views}`, req.ip);
    res.status(201).json({ success: true, message: 'Đã gửi video, vui lòng chờ admin xét duyệt.', videoId });
  } catch (err) { next(err); }
};

exports.myVideos = async (req, res, next) => {
  try {
    res.json({ success: true, videos: await VideoModel.listByUser(req.user.id) });
  } catch (err) { next(err); }
};

// ===== ADMIN =====
exports.adminList = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const videos = await VideoModel.listAll({
      status, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 30,
    });
    res.json({ success: true, videos });
  } catch (err) { next(err); }
};

// Admin cập nhật lượt xem thực tế đã kiểm tra (nếu khác với khai báo) trước khi duyệt, tùy chọn
exports.adminUpdateViews = async (req, res, next) => {
  try {
    const { views } = req.body;
    await VideoModel.setDeclaredViews(req.params.id, views);
    res.json({ success: true, message: 'Đã cập nhật lượt xem.' });
  } catch (err) { next(err); }
};

exports.adminApprove = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const video = await VideoModel.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });
    if (video.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Video này đã được duyệt trước đó.' });
    }

    const { maxMilestone } = await VideoModel.highestMilestoneAwarded(video.id);
    const { milestone, pointsToAward } = calculateRewardDiff(video.declared_views, maxMilestone);

    await conn.beginTransaction();
    await conn.query(`UPDATE videos SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`, [req.user.id, video.id]);

    if (milestone && pointsToAward > 0) {
      await VideoModel.recordReward(video.id, milestone.views, pointsToAward, conn);
      await UserModel.adjustPoints(video.user_id, pointsToAward, 'video_reward', video.id, conn);
    }
    await conn.commit();
    conn.release();

    await notify(
      video.user_id,
      'video_approved',
      'Video đã được duyệt',
      pointsToAward > 0
        ? `Video của bạn đã được duyệt. Bạn nhận được ${pointsToAward.toLocaleString('vi-VN')} điểm.`
        : 'Video của bạn đã được duyệt.'
    );
    await logAction(req.user.id, 'approve_video', `video_id=${video.id} points_awarded=${pointsToAward}`, req.ip);

    res.json({ success: true, message: 'Đã duyệt video.', pointsAwarded: pointsToAward });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch (_) {}
    next(err);
  }
};

exports.adminReject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });

    const video = await VideoModel.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });

    await VideoModel.reject(video.id, reason);
    await notify(video.user_id, 'video_rejected', 'Video bị từ chối', `Lý do: ${reason}`);
    await logAction(req.user.id, 'reject_video', `video_id=${video.id} reason=${reason}`, req.ip);

    res.json({ success: true, message: 'Đã từ chối video.' });
  } catch (err) { next(err); }
};
