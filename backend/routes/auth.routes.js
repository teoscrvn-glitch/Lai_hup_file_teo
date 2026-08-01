const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post(
  '/register',
  authLimiter,
  [
    body('fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Họ tên không hợp lệ.'),
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Tên đăng nhập chỉ gồm chữ, số, dấu gạch dưới (3-30 ký tự).'),
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Mật khẩu phải có ít nhất 8 ký tự.')
      .matches(/\d/)
      .withMessage('Mật khẩu phải chứa ít nhất 1 chữ số.'),
  ],
  authController.register
);

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.get('/me', requireAuth, authController.me);
router.post(
  '/change-password',
  requireAuth,
  [
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự.'),
  ],
  authController.changePassword
);

module.exports = router;
