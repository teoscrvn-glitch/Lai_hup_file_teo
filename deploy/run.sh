#!/bin/bash
# Khởi động / khởi động lại server bằng PM2
set -e
cd ../backend
pm2 start server.js --name laihupfile --time
pm2 save
echo "Server đang chạy. Xem log: pm2 logs laihupfile"
