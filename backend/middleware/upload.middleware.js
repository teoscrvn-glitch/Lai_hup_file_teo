const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const random = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `${random}${ext}`;
}

// ===== Thumbnail / avatar upload (public, ảnh only) =====
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'public', file.fieldname === 'avatar' ? 'avatars' : 'thumbnails');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
});

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.'), false);
  }
  cb(null, true);
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cho ảnh
});

// ===== Paid file upload (private, không public) =====
const paidStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'paid');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
});

const paidFileFilter = (req, file, cb) => {
  if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Định dạng file không được phép.'), false);
  }
  cb(null, true);
};

const uploadPaidFile = multer({
  storage: paidStorage,
  fileFilter: paidFileFilter,
  limits: { fileSize: config.upload.maxSizeMB * 1024 * 1024 },
});

// ===== Combined upload cho form Thêm/Sửa file (thumbnail ảnh + paidFile) =====
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      const dir = path.join(__dirname, '..', 'uploads', 'public', 'thumbnails');
      ensureDir(dir);
      return cb(null, dir);
    }
    const dir = path.join(__dirname, '..', 'uploads', 'paid');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
});

const combinedFileFilter = (req, file, cb) => {
  if (file.fieldname === 'thumbnail') {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Thumbnail phải là ảnh PNG, JPG hoặc WEBP.'), false);
    return cb(null, true);
  }
  if (file.fieldname === 'paidFile') {
    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Định dạng file trả phí không được phép.'), false);
    }
    return cb(null, true);
  }
  cb(new Error('Trường file không hợp lệ.'), false);
};

const uploadFileFields = multer({
  storage: combinedStorage,
  fileFilter: combinedFileFilter,
  limits: { fileSize: config.upload.maxSizeMB * 1024 * 1024 },
}).fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'paidFile', maxCount: 1 }]);

module.exports = { uploadImage, uploadPaidFile, uploadFileFields };
