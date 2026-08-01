const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth.middleware');
const { downloadLimiter } = require('../middleware/rateLimiter');

// ===== PUBLIC =====
router.get('/', optionalAuth, fileController.list);
router.get('/:slug', optionalAuth, fileController.getBySlug);

// ===== USER =====
// Bước 1: yêu cầu tải -> trả link tạm thời (file trả phí) hoặc link thật ngay (file miễn phí)
router.post('/:id/download', optionalAuth, downloadLimiter, fileController.download);
router.post('/:id/favorite', requireAuth, fileController.toggleFavorite);

// Toàn bộ route ADMIN (thêm/sửa/xóa/đổi trạng thái file) đã chuyển sang admin.routes.js,
// mount tại đường dẫn quản trị riêng (KHÔNG dùng chung /api/files) — xem server.js.

module.exports = router;
