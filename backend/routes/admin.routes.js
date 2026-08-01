const express = require('express');
const router = express.Router();

const adminAuthController = require('../controllers/adminAuth.controller');
const adminController = require('../controllers/admin.controller');
const fileController = require('../controllers/file.controller');
const categoryController = require('../controllers/category.controller');
const orderController = require('../controllers/order.controller');
const videoController = require('../controllers/video.controller');

const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdminPanel, requirePermission } = require('../middleware/adminPanel.middleware');
const { uploadFileFields } = require('../middleware/upload.middleware');
const { authLimiter } = require('../middleware/rateLimiter');

// ===== ĐĂNG NHẬP (public trong router này, nhưng rate-limit chặt + ẩn danh tính lỗi) =====
router.post('/login', authLimiter, adminAuthController.login);

// ----- Từ đây trở xuống: bắt buộc đăng nhập + là admin có phân quyền hợp lệ -----
// Người dùng thường / chưa đăng nhập -> 404 (không lộ sự tồn tại của trang quản trị)
router.use(requireAuth, requireAdminPanel);

router.post('/logout', adminAuthController.logout);
router.get('/me', adminAuthController.me);

// ===== DASHBOARD (mọi cấp quyền đều xem được) =====
router.get('/dashboard', adminController.dashboard);

// ===== QUẢN LÝ FILE (moderator trở lên) =====
router.post('/files', requirePermission('moderator'), uploadFileFields, fileController.create);
router.put('/files/:id', requirePermission('moderator'), uploadFileFields, fileController.update);
router.patch('/files/:id/status', requirePermission('moderator'), fileController.setStatus);
router.delete('/files/:id', requirePermission('admin'), fileController.remove);

// ===== DANH MỤC / TAG (admin trở lên) =====
router.post('/categories', requirePermission('admin'), categoryController.createCategory);
router.put('/categories/:id', requirePermission('admin'), categoryController.updateCategory);
router.delete('/categories/:id', requirePermission('admin'), categoryController.deleteCategory);

// ===== ĐƠN HÀNG / THANH TOÁN (moderator trở lên duyệt, admin trở lên từ chối) =====
router.get('/orders', requirePermission('moderator'), orderController.adminListOrders);
router.post('/orders/:orderCode/approve', requirePermission('moderator'), orderController.adminApprovePayment);
router.post('/orders/:orderCode/reject', requirePermission('admin'), orderController.adminRejectPayment);

// ===== VIDEO (moderator trở lên) =====
router.get('/videos', requirePermission('moderator'), videoController.adminList);
router.patch('/videos/:id/views', requirePermission('moderator'), videoController.adminUpdateViews);
router.post('/videos/:id/approve', requirePermission('moderator'), videoController.adminApprove);
router.post('/videos/:id/reject', requirePermission('moderator'), videoController.adminReject);

// ===== NGƯỜI DÙNG (admin trở lên) =====
router.get('/users', requirePermission('admin'), adminController.listUsers);
router.patch('/users/:id/status', requirePermission('admin'), adminController.setUserStatus);
router.patch('/users/:id/points', requirePermission('admin'), adminController.adjustUserPoints);

// ===== PHÂN QUYỀN ADMIN (chỉ Super Admin) =====
router.get('/admins', requirePermission('super'), adminController.listAdmins);
router.post('/admins', requirePermission('super'), adminController.grantAdmin);
router.delete('/admins/:userId', requirePermission('super'), adminController.revokeAdmin);

// ===== NHẬT KÝ HỆ THỐNG (admin trở lên) =====
router.get('/logs', requirePermission('admin'), adminController.listLogs);

// ===== IP BỊ CHẶN / CHỐNG DDOS (admin trở lên) =====
router.get('/blocked-ips', requirePermission('admin'), adminController.listBlockedIps);
router.post('/blocked-ips', requirePermission('admin'), adminController.blockIp);
router.delete('/blocked-ips/:ip', requirePermission('admin'), adminController.unblockIp);

module.exports = router;
