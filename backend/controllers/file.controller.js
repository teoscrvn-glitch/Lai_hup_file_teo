const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const config = require('../config/config');
const FileModel = require('../models/file.model');
const { TagModel } = require('../models/category.model');
const DownloadTokenModel = require('../models/downloadToken.model');
const { generateSecureRandomToken, hashToken } = require('../utils/jwt');
const { isKnownFileSignature, requiresSignatureCheck } = require('../utils/fileSignature');
const { logAction } = require('../utils/logger');

// ===== PUBLIC: danh sách / tìm kiếm =====
exports.list = async (req, res, next) => {
  try {
    const { q, categoryId, tag, minPrice, maxPrice, freeOnly, paidOnly, sort, page, limit } = req.query;
    const result = await FileModel.search({
      q, categoryId, tag,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
      freeOnly: freeOnly === 'true',
      paidOnly: paidOnly === 'true',
      sort,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 20,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// ===== PUBLIC: chi tiết file (theo slug) =====
exports.getBySlug = async (req, res, next) => {
  try {
    const file = await FileModel.findBySlug(req.params.slug);
    if (!file || file.status === 'hidden') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });
    }
    if (file.status === 'locked' && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'File đang bị khóa.' });
    }
    await FileModel.incrementView(file.id);

    let owned = false;
    if (req.user) owned = await FileModel.userOwnsFile(req.user.id, file.id);

    // Không lộ đường dẫn file thật (paid_file_path / free_link nếu locked_link) cho client
    const safeFile = { ...file };
    delete safeFile.paid_file_path;
    if (file.file_type === 'free' && file.free_mode === 'locked_link') {
      delete safeFile.free_link; // chỉ trả khi user request vượt link
    }

    res.json({ success: true, file: safeFile, owned });
  } catch (err) { next(err); }
};

// ===== ADMIN: tạo file mới =====
exports.create = async (req, res, next) => {
  try {
    const {
      title, description, categoryId, version, fileType,
      priceMoney, pricePoints, freeMode, freeLink, tags, status,
    } = req.body;

    if (!title || !fileType) {
      return res.status(400).json({ success: false, message: 'Thiếu tên file hoặc loại file.' });
    }
    if (fileType === 'paid' && !req.files?.paidFile) {
      return res.status(400).json({ success: false, message: 'File trả phí bắt buộc phải upload file thật.' });
    }
    if (fileType === 'free' && freeMode === 'locked_link' && !freeLink) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập link vượt.' });
    }

    // ----- Kiểm tra chữ ký nhị phân thật của file (không tin mimetype client khai báo) -----
    const uploadedFiles = [req.files?.thumbnail?.[0], req.files?.paidFile?.[0]].filter(Boolean);
    for (const f of uploadedFiles) {
      if (requiresSignatureCheck(f.mimetype) && !isKnownFileSignature(f.path)) {
        fs.unlink(f.path, () => {});
        return res.status(400).json({ success: false, message: `File "${f.originalname}" không đúng định dạng thật (đã đổi đuôi hoặc bị hỏng).` });
      }
    }

    const thumbnail = req.files?.thumbnail?.[0]
      ? `/uploads/public/thumbnails/${req.files.thumbnail[0].filename}`
      : null;
    const paidFilePath = req.files?.paidFile?.[0]
      ? `uploads/paid/${req.files.paidFile[0].filename}` // KHÔNG có /public — private
      : null;

    const slug = FileModel.buildSlug(title);
    const fileId = await FileModel.create({
      title, slug, description, thumbnail,
      categoryId: categoryId || null, version, fileType,
      priceMoney: fileType === 'paid' ? priceMoney : 0,
      pricePoints: pricePoints || 0,
      freeMode: fileType === 'free' ? freeMode : null,
      freeLink: fileType === 'free' ? freeLink : null,
      paidFilePath,
      status: status || 'visible',
      createdBy: req.user.id,
    });

    if (tags) {
      const tagNames = Array.isArray(tags) ? tags : tags.split(',');
      const tagIds = await TagModel.findOrCreateMany(tagNames);
      await FileModel.attachTags(fileId, tagIds);
    }

    await logAction(req.user.id, 'create_file', `file_id=${fileId} title=${title}`, req.ip);
    res.status(201).json({ success: true, message: 'Tạo file thành công.', fileId, slug });
  } catch (err) { next(err); }
};

// ===== ADMIN: sửa file =====
exports.update = async (req, res, next) => {
  try {
    const file = await FileModel.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });

    const uploadedFiles = [req.files?.thumbnail?.[0], req.files?.paidFile?.[0]].filter(Boolean);
    for (const f of uploadedFiles) {
      if (requiresSignatureCheck(f.mimetype) && !isKnownFileSignature(f.path)) {
        fs.unlink(f.path, () => {});
        return res.status(400).json({ success: false, message: `File "${f.originalname}" không đúng định dạng thật (đã đổi đuôi hoặc bị hỏng).` });
      }
    }

    const data = { ...req.body };
    if (req.files?.thumbnail?.[0]) {
      data.thumbnail = `/uploads/public/thumbnails/${req.files.thumbnail[0].filename}`;
    }
    if (req.files?.paidFile?.[0]) {
      data.paidFilePath = `uploads/paid/${req.files.paidFile[0].filename}`;
    }

    await FileModel.update(req.params.id, data);

    if (req.body.tags) {
      const tagNames = Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',');
      const tagIds = await TagModel.findOrCreateMany(tagNames);
      await FileModel.replaceTags(req.params.id, tagIds);
    }

    await logAction(req.user.id, 'update_file', `file_id=${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Cập nhật thành công.' });
  } catch (err) { next(err); }
};

// ===== ADMIN: đổi trạng thái nhanh (ẩn/hiện/khóa) =====
exports.setStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // 'visible' | 'hidden' | 'locked'
    if (!['visible', 'hidden', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }
    await FileModel.update(req.params.id, { status });
    await logAction(req.user.id, 'set_file_status', `file_id=${req.params.id} status=${status}`, req.ip);
    res.json({ success: true, message: 'Đã cập nhật trạng thái.' });
  } catch (err) { next(err); }
};

// ===== ADMIN: xóa file =====
exports.remove = async (req, res, next) => {
  try {
    const file = await FileModel.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });

    if (file.paid_file_path) {
      const fullPath = path.join(__dirname, '..', file.paid_file_path);
      fs.unlink(fullPath, () => {});
    }
    await FileModel.delete(req.params.id);
    await logAction(req.user.id, 'delete_file', `file_id=${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Đã xóa file.' });
  } catch (err) { next(err); }
};

// ===== BƯỚC 1: yêu cầu tải — kiểm tra quyền, sinh link tải có thời hạn ngắn (mặc định 5 phút), dùng 1 lần =====
exports.download = async (req, res, next) => {
  try {
    const file = await FileModel.findById(req.params.id);
    if (!file || file.status !== 'visible') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy file.' });
    }

    // ----- FILE MIỄN PHÍ: không cần token, trả link ngay (link vượt hoặc link tải trực tiếp) -----
    if (file.file_type === 'free') {
      await FileModel.incrementDownload(file.id);
      await logAction(req.user?.id, 'download_free', `file_id=${file.id} mode=${file.free_mode}`, req.ip);
      return res.json({ success: true, redirectUrl: file.free_link });
    }

    // ----- FILE TRẢ PHÍ: bắt buộc đăng nhập + sở hữu -----
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tải file.' });
    }
    const owned = await FileModel.userOwnsFile(req.user.id, file.id);
    if (!owned && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn chưa sở hữu file này.' });
    }
    if (!file.paid_file_path) {
      return res.status(500).json({ success: false, message: 'File chưa được cấu hình đúng, liên hệ admin.' });
    }

    // Sinh token tải: KHÔNG trả đường dẫn file thật cho client, chỉ trả 1 URL tạm thời dùng 1 lần
    const rawToken = generateSecureRandomToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.download.tokenExpiresMinutes * 60 * 1000);

    await DownloadTokenModel.create({
      tokenHash, userId: req.user.id, fileId: file.id, ipAddress: req.ip, expiresAt,
    });
    await logAction(req.user.id, 'request_download_token', `file_id=${file.id}`, req.ip);

    res.json({
      success: true,
      downloadUrl: `/api/download/${rawToken}`,
      expiresInMinutes: config.download.tokenExpiresMinutes,
    });
  } catch (err) { next(err); }
};

// ===== BƯỚC 2: tiêu thụ token — xác thực, stream file, đánh dấu đã dùng (không thể dùng lại) =====
exports.serveDownloadToken = async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const tokenRecord = await DownloadTokenModel.findValidByHash(tokenHash);
    if (!tokenRecord) {
      return res.status(410).json({ success: false, message: 'Liên kết tải đã hết hạn hoặc không hợp lệ.' });
    }

    const file = await FileModel.findById(tokenRecord.file_id);
    if (!file || !file.paid_file_path) {
      return res.status(404).json({ success: false, message: 'File không còn tồn tại.' });
    }

    const fullPath = path.join(__dirname, '..', file.paid_file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'File không tồn tại trên máy chủ.' });
    }

    // Đánh dấu đã dùng NGAY LẬP TỨC (trước khi stream) để chống dùng đồng thời/lặp lại
    await DownloadTokenModel.markUsed(tokenRecord.id);
    await db.query(
      'INSERT INTO downloads (user_id, file_id, ip_address) VALUES (?, ?, ?)',
      [tokenRecord.user_id, tokenRecord.file_id, req.ip]
    );
    await logAction(tokenRecord.user_id, 'download_paid_confirmed', `file_id=${file.id}`, req.ip);

    res.download(fullPath, path.basename(fullPath));
  } catch (err) { next(err); }
};


// ===== Yêu thích =====
exports.toggleFavorite = async (req, res, next) => {
  try {
    const fileId = req.params.id;
    const [existing] = await db.query(
      'SELECT * FROM favorites WHERE user_id = ? AND file_id = ?',
      [req.user.id, fileId]
    );
    if (existing.length > 0) {
      await db.query('DELETE FROM favorites WHERE user_id = ? AND file_id = ?', [req.user.id, fileId]);
      return res.json({ success: true, favorited: false });
    }
    await db.query('INSERT INTO favorites (user_id, file_id) VALUES (?, ?)', [req.user.id, fileId]);
    res.json({ success: true, favorited: true });
  } catch (err) { next(err); }
};
