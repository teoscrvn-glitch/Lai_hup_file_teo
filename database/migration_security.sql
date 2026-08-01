-- =====================================================
-- MIGRATION: SECURITY HARDENING
-- CHỈ chạy file này nếu bạn đã tạo database từ database.sql PHIÊN BẢN CŨ (Part 1/2),
-- trước khi các bảng/cột bảo mật này được thêm trực tiếp vào database.sql.
-- Cài đặt MỚI hoàn toàn: dùng database.sql mới nhất, KHÔNG cần chạy file này.
-- mysql -u root -p laihupfile < migration_security.sql
-- =====================================================
USE laihupfile;

-- ----- 1. Chống brute-force đăng nhập -----
ALTER TABLE users
  ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN locked_until DATETIME NULL DEFAULT NULL AFTER failed_login_attempts;

-- ----- 2. Refresh token (lưu hash, không lưu token gốc) -----
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

-- ----- 3. Link tải file có thời hạn ngắn, dùng 1 lần -----
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

-- ----- 4. Chặn IP lạm dụng API (bổ sung tầng app, cạnh rate-limit) -----
CREATE TABLE blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason VARCHAR(255),
  blocked_until DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----- 5. Phân quyền admin: Super Admin / Admin / Moderator -----
-- (đổi enum cũ 'super','manager','moderator' -> 'super','admin','moderator')
ALTER TABLE admins
  MODIFY COLUMN permission_level ENUM('super','admin','moderator') DEFAULT 'moderator';

-- ----- 6. Mở rộng bảng logs để phân loại rõ hơn (không bắt buộc, nhưng hữu ích để lọc) -----
ALTER TABLE logs
  ADD COLUMN severity ENUM('info','warning','error') NOT NULL DEFAULT 'info' AFTER action;
