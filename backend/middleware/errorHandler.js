function notFoundHandler(req, res, next) {
  res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên yêu cầu.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File tải lên vượt quá dung lượng cho phép.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const status = err.status || 500;
  const message = err.expose ? err.message : 'Đã có lỗi xảy ra ở máy chủ. Vui lòng thử lại sau.';
  res.status(status).json({ success: false, message });
}

module.exports = { notFoundHandler, errorHandler };
