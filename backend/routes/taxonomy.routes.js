const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// ===== PUBLIC =====
router.get('/categories', categoryController.listCategories);
router.get('/tags', categoryController.listTags);

// Route ADMIN (thêm/sửa/xóa danh mục) đã chuyển sang admin.routes.js.

module.exports = router;
