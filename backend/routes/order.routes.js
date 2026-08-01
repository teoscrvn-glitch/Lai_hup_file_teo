const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// ===== USER =====
router.post('/files/:fileId/buy', requireAuth, orderController.createOrder);
router.post('/files/:fileId/buy-with-points', requireAuth, orderController.buyWithPoints);
router.get('/me', requireAuth, orderController.myOrders);

// Route ADMIN (danh sách/duyệt/từ chối đơn) đã chuyển sang admin.routes.js.

module.exports = router;
