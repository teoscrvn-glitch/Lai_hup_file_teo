-- =====================================================
-- LẠI HÚP FILE - DATABASE SCHEMA (MySQL 8+)
-- =====================================================

CREATE DATABASE IF NOT EXISTS laihupfile
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laihupfile;

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(255) DEFAULT '/uploads/avatars/default.png',
  points BIGINT DEFAULT 0,
  role ENUM('user','admin') DEFAULT 'user',
  status ENUM('active','banned') DEFAULT 'active',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL DEFAULT NULL,
  remember_token VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- CATEGORIES / TAGS
-- =====================================================
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- =====================================================
-- FILES
-- =====================================================
CREATE TABLE files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  description TEXT,
  thumbnail VARCHAR(255),
  category_id INT,
  version VARCHAR(30) DEFAULT '1.0',
  file_type ENUM('free','paid') NOT NULL DEFAULT 'free',
  price_money DECIMAL(12,2) DEFAULT 0,
  price_points BIGINT DEFAULT 0,
  free_mode ENUM('direct','locked_link') DEFAULT 'direct',
  free_link VARCHAR(500),          -- direct download or "vượt link" URL
  paid_file_path VARCHAR(500),     -- real stored file path (backend-protected)
  views INT DEFAULT 0,
  downloads INT DEFAULT 0,
  purchases INT DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT 0,
  rating_count INT DEFAULT 0,
  status ENUM('visible','hidden','locked') DEFAULT 'visible',
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FULLTEXT KEY ft_title_desc (title, description)
) ENGINE=InnoDB;

CREATE TABLE file_tags (
  file_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (file_id, tag_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- ORDERS (mua bằng tiền)
-- =====================================================
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL UNIQUE, -- LHF-XXXXXXXX
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','expired','cancelled') DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- PAYMENTS (bank transfer verification)
-- =====================================================
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  bank_name VARCHAR(100),
  account_name VARCHAR(150),
  account_number VARCHAR(50),
  transfer_content VARCHAR(100), -- = order_code
  qr_code_url VARCHAR(500),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  approved_by INT,
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- VIDEOS + REWARDS (kiếm điểm bằng video)
-- =====================================================
CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT,                    -- file được giới thiệu trong video (nếu có)
  video_link VARCHAR(500) NOT NULL,
  platform ENUM('tiktok','facebook','youtube','reels','shorts','other') NOT NULL,
  declared_views BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  reject_reason VARCHAR(255),
  reviewed_by INT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Lưu mốc điểm cao nhất đã nhận cho từng video, để chỉ cộng phần chênh lệch
CREATE TABLE video_rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  video_id INT NOT NULL,
  milestone_views BIGINT NOT NULL,   -- 1000, 3000, 5000...
  points_awarded BIGINT NOT NULL,    -- điểm cộng thêm ở mốc này (chênh lệch)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- POINTS HISTORY
-- =====================================================
CREATE TABLE points_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount BIGINT NOT NULL,          -- + cộng / - trừ
  reason ENUM('video_reward','purchase','admin_adjust','refund') NOT NULL,
  reference_id INT,                -- video_id hoặc file_id liên quan
  balance_after BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- DOWNLOADS / FAVORITES / COMMENTS / RATINGS
-- =====================================================
CREATE TABLE downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favorites (
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, file_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_id INT DEFAULT NULL,   -- trả lời bình luận
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  stars TINYINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_file_rating (user_id, file_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,           -- người nhận
  type ENUM('video_approved','video_rejected','new_file','update','promotion','order_approved') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- ADMINS (quyền mở rộng, tách khỏi users.role nếu cần phân quyền chi tiết)
-- =====================================================
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  permission_level ENUM('super','admin','moderator') DEFAULT 'moderator',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- SETTINGS (cấu hình chung, key-value)
-- =====================================================
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- LOGS (nhật ký thao tác)
-- =====================================================
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(150) NOT NULL,
  severity ENUM('info','warning','error') NOT NULL DEFAULT 'info',
  detail TEXT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- REFRESH TOKENS (đăng nhập bền vững, tách khỏi access token JWT ngắn hạn)
-- =====================================================
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255),
  ip_address VARCHAR(45),
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash)
) ENGINE=InnoDB;

-- =====================================================
-- DOWNLOAD TOKENS (link tải có thời hạn ngắn, dùng 1 lần, chống đoán URL)
-- =====================================================
CREATE TABLE download_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  ip_address VARCHAR(45),
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- =====================================================
-- BLOCKED IPS (chặn tạm thời IP lạm dụng API, bổ sung tầng app cho rate-limit)
-- =====================================================
CREATE TABLE blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason VARCHAR(255),
  blocked_until DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- DEFAULT SETTINGS
-- =====================================================
INSERT INTO settings (setting_key, setting_value) VALUES
('bank_name', ''),
('bank_account_name', ''),
('bank_account_number', ''),
('order_expire_hours', '168'),
('site_name', 'Lại Húp File');

-- =====================================================
-- DEFAULT ADMIN (đổi mật khẩu ngay sau khi cài đặt!)
-- password_hash bên dưới là placeholder — sinh thật bằng bcrypt khi chạy script seed
-- =====================================================
-- INSERT INTO users (full_name, username, email, password_hash, role)
-- VALUES ('Administrator', 'admin', 'admin@laihupfile.com', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'admin');
