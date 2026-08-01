const AdminModel = require('../models/admin.model');
const { logAction } = require('../utils/logger');

const LEVEL_RANK = { moderator: 1, admin: 2, super: 3 };

// Bắt buộc đăng nhập (dùng SAU requireAuth) + là admin + có bản ghi phân quyền hợp lệ.
// Với người dùng thường hoặc chưa đăng nhập đúng cách: trả 404 (không phải 403) để
// KHÔNG lộ rằng đường dẫn /admin-panel-xxx này tồn tại và là trang quản trị.
async function requireAdminPanel(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trang.' });
  }

  const permissionLevel = await AdminModel.getPermissionLevel(req.user.id);
  if (!permissionLevel) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy trang.' });
  }

  req.adminPermission = permissionLevel; // 'super' | 'admin' | 'moderator'
  next();
}

// Yêu cầu mức quyền tối thiểu, dùng SAU requireAdminPanel.
// Ví dụ: requirePermission('admin') cho phép 'admin' và 'super', chặn 'moderator'.
function requirePermission(minLevel) {
  return async (req, res, next) => {
    const rank = LEVEL_RANK[req.adminPermission] || 0;
    const minRank = LEVEL_RANK[minLevel] || 99;
    if (rank < minRank) {
      await logAction(req.user.id, 'permission_denied', `required=${minLevel} has=${req.adminPermission}`, req.ip);
      return res.status(403).json({ success: false, message: 'Bạn không đủ quyền thực hiện thao tác này.' });
    }
    next();
  };
}

module.exports = { requireAdminPanel, requirePermission };
