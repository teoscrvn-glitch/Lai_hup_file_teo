const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { downloadLimiter } = require('../middleware/rateLimiter');

// GET /api/download/:token — link tải có thời hạn ngắn, dùng 1 lần (xem file.controller.serveDownloadToken)
// Không cần đăng nhập lại: bản thân token đã chứng minh quyền sở hữu tại thời điểm được cấp.
router.get('/:token', downloadLimiter, fileController.serveDownloadToken);

module.exports = router;
