const fs = require('fs');

// Chữ ký nhị phân (magic bytes) của các định dạng file được phép upload.
// Client có thể khai báo sai Content-Type, nên phải đọc byte đầu file thật để xác nhận.
const SIGNATURES = [
  { ext: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'zip', bytes: [0x50, 0x4b, 0x05, 0x06] }, // zip rỗng
  { ext: 'rar', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { ext: '7z', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, secondary: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function matchesSignature(buffer, sig) {
  const offset = sig.offset || 0;
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buffer[offset + i] !== sig.bytes[i]) return false;
  }
  if (sig.secondary) {
    for (let i = 0; i < sig.secondary.bytes.length; i++) {
      if (buffer[sig.secondary.offset + i] !== sig.secondary.bytes[i]) return false;
    }
  }
  return true;
}

// Đọc 16 byte đầu file và so khớp với danh sách chữ ký hợp lệ.
// Dùng cho: file trả phí (zip/rar/7z/pdf...) và ảnh thumbnail/avatar (png/jpg/webp).
// Trả về true nếu khớp ít nhất 1 chữ ký đã biết — KHÔNG chấp nhận file .txt/.exe đổi đuôi thành .zip.
function isKnownFileSignature(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);
  return SIGNATURES.some((sig) => matchesSignature(buffer, sig));
}

// File .txt (đề học tập, tài liệu) không có magic byte cố định — cho phép riêng dựa theo đuôi
// đã qua whitelist MIME ở multer, KHÔNG áp dụng check chữ ký (chỉ dùng cho zip/rar/7z/pdf/ảnh).
function requiresSignatureCheck(mimetype) {
  return mimetype !== 'text/plain';
}

module.exports = { isKnownFileSignature, requiresSignatureCheck };
