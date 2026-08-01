const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// ===== USER =====
router.post('/', requireAuth, videoController.submit);
router.get('/me', requireAuth, videoController.myVideos);

// Route ADMIN (danh sách/duyệt/từ chối video) đã chuyển sang admin.routes.js.

module.exports = router;
