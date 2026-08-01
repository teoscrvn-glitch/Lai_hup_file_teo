#!/bin/bash
# Script cài đặt Lại Húp File trên VPS Ubuntu 22.04+
set -e

echo ">> Cập nhật hệ thống..."
sudo apt update && sudo apt upgrade -y

echo ">> Cài Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo ">> Cài MySQL Server..."
sudo apt install -y mysql-server
sudo mysql_secure_installation

echo ">> Cài Nginx..."
sudo apt install -y nginx

echo ">> Cài Certbot (Let's Encrypt)..."
sudo apt install -y certbot python3-certbot-nginx

echo ">> Cài PM2 (quản lý process Node.js)..."
sudo npm install -g pm2

echo ">> Import database..."
mysql -u root -p < ../database/database.sql

echo ">> Cài dependencies backend..."
cd ../backend && npm install

echo ">> Sao chép file .env mẫu, hãy chỉnh sửa trước khi chạy..."
cp .env.example .env

echo ">> Hoàn tất bước cài đặt cơ bản."
echo "1. Chỉnh sửa backend/.env với thông tin DB / JWT / bank thật."
echo "2. Chạy: npm run seed:admin   (tạo tài khoản admin đầu tiên)"
echo "3. Chạy: pm2 start server.js --name laihupfile"
echo "4. Cấu hình Nginx: sudo cp deploy/nginx.conf /etc/nginx/sites-available/laihupfile"
echo "   sudo ln -s /etc/nginx/sites-available/laihupfile /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl restart nginx"
echo "5. Bật SSL: sudo certbot --nginx -d your-domain.com -d www.your-domain.com"
