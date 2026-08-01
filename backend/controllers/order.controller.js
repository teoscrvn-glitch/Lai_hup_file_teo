const db = require('../config/db');
const config = require('../config/config');
const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const FileModel = require('../models/file.model');
const UserModel = require('../models/user.model');
const generateOrderCode = require('../utils/generateOrderCode');
const { logAction } = require('../utils/logger');
const { notify } = require('../services/notification.service');

// ===== Tạo đơn mua bằng tiền =====
exports.createOrder = async (req, res, next) => {
  try {
    const fileId = req.params.fileId;
    const file = await FileModel.findById(fileId);
    if (!file || file.status !== 'visible' || file.file_type !== 'paid') {
      return res.status(404).json({ success: false, message: 'File không hợp lệ để mua.' });
    }

    const owned = await FileModel.userOwnsFile(req.user.id, file.id);
    if (owned) {
      return res.status(400).json({ success: false, message: 'Bạn đã sở hữu file này rồi.' });
    }

    const existingPending = await OrderModel.findPendingByUserAndFile(req.user.id, file.id);
    if (existingPending) {
      const payment = await PaymentModel.findByOrderId(existingPending.id);
      return res.json({ success: true, order: existingPending, payment });
    }

    const orderCode = generateOrderCode();
    const expiresAt = new Date(Date.now() + config.order.expireHours * 60 * 60 * 1000);
    const orderId = await OrderModel.create({
      orderCode, userId: req.user.id, fileId: file.id, amount: file.price_money, expiresAt,
    });

    // Sinh QR: dùng VietQR quicklink (ảnh động, không cần tích hợp API ngân hàng thật)
    const qrImageUrl = `https://img.vietqr.io/image/${encodeURIComponent(config.bank.name)}-${encodeURIComponent(config.bank.accountNumber)}-compact2.png?amount=${Math.round(file.price_money)}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(config.bank.accountName)}`;

    const paymentId = await PaymentModel.create({
      orderId,
      bankName: config.bank.name,
      accountName: config.bank.accountName,
      accountNumber: config.bank.accountNumber,
      transferContent: orderCode,
      qrCodeUrl: qrImageUrl,
    });

    await logAction(req.user.id, 'create_order', `order_code=${orderCode} file_id=${file.id}`, req.ip);

    res.status(201).json({
      success: true,
      order: { id: orderId, orderCode, amount: file.price_money, expiresAt, status: 'pending' },
      payment: {
        id: paymentId,
        bankName: config.bank.name,
        accountName: config.bank.accountName,
        accountNumber: config.bank.accountNumber,
        transferContent: orderCode,
        qrCodeUrl: qrImageUrl,
      },
    });
  } catch (err) { next(err); }
};

// ===== Mua bằng điểm (transaction) =====
exports.buyWithPoints = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const fileId = req.params.fileId;
    const file = await FileModel.findById(fileId);
    if (!file || file.status !== 'visible') {
      return res.status(404).json({ success: false, message: 'File không hợp lệ.' });
    }
    if (!file.price_points || file.price_points <= 0) {
      return res.status(400).json({ success: false, message: 'File này không hỗ trợ mua bằng điểm.' });
    }

    const owned = await FileModel.userOwnsFile(req.user.id, file.id);
    if (owned) {
      return res.status(400).json({ success: false, message: 'Bạn đã sở hữu file này rồi.' });
    }

    await conn.beginTransaction();
    const [[freshUser]] = await conn.query('SELECT points FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
    if (freshUser.points < file.price_points) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Bạn không đủ điểm.',
        missingPoints: file.price_points - freshUser.points,
      });
    }

    await UserModel.adjustPoints(req.user.id, -file.price_points, 'purchase', file.id, conn);
    await conn.query('UPDATE files SET purchases = purchases + 1 WHERE id = ?', [file.id]);
    await conn.commit();
    conn.release();

    await logAction(req.user.id, 'buy_with_points', `file_id=${file.id} points=${file.price_points}`, req.ip);
    res.json({ success: true, message: 'Mua file thành công bằng điểm.' });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch (_) {}
    next(err);
  }
};

exports.myOrders = async (req, res, next) => {
  try {
    res.json({ success: true, orders: await OrderModel.listByUser(req.user.id) });
  } catch (err) { next(err); }
};

// ===== ADMIN: danh sách đơn / duyệt / từ chối =====
exports.adminListOrders = async (req, res, next) => {
  try {
    await OrderModel.expireOldOrders();
    const { status, page, limit } = req.query;
    const orders = await OrderModel.listAll({
      status, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 30,
    });
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

exports.adminApprovePayment = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const order = await OrderModel.findByCode(req.params.orderCode);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã được xử lý hoặc đã hết hạn.' });
    }
    const payment = await PaymentModel.findByOrderId(order.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thanh toán.' });

    await conn.beginTransaction();
    await PaymentModel.approve(payment.id, req.user.id, conn);
    await OrderModel.markStatus(order.id, 'paid', conn);
    await conn.query('UPDATE files SET purchases = purchases + 1 WHERE id = ?', [order.file_id]);
    await conn.commit();
    conn.release();

    await notify(order.user_id, 'order_approved', 'Đơn hàng đã được duyệt', `Đơn ${order.order_code} đã được xác nhận thanh toán. Bạn có thể tải file ngay.`);
    await logAction(req.user.id, 'approve_payment', `order_code=${order.order_code}`, req.ip);

    res.json({ success: true, message: 'Đã duyệt thanh toán.' });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch (_) {}
    next(err);
  }
};

exports.adminRejectPayment = async (req, res, next) => {
  try {
    const order = await OrderModel.findByCode(req.params.orderCode);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const payment = await PaymentModel.findByOrderId(order.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin thanh toán.' });

    await PaymentModel.reject(payment.id, req.user.id);
    await OrderModel.markStatus(order.id, 'cancelled');
    await notify(order.user_id, 'order_approved', 'Đơn hàng bị từ chối', `Đơn ${order.order_code} đã bị từ chối. Vui lòng liên hệ admin nếu có thắc mắc.`);
    await logAction(req.user.id, 'reject_payment', `order_code=${order.order_code}`, req.ip);

    res.json({ success: true, message: 'Đã từ chối đơn hàng.' });
  } catch (err) { next(err); }
};
