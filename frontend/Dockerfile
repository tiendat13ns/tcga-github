# Node.js 22 alpine — Vitest 5 / jsdom 30 yêu cầu Node >= 22
FROM node:22-alpine

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Copy package.json + lockfile trước để tận dụng cache của Docker
COPY package.json package-lock.json ./

# Cài đúng phiên bản trong lockfile (không resolve lại "latest")
RUN npm ci

# Copy toàn bộ source code vào container
COPY . .

# Mở cổng 5173 (cổng mặc định của Vite)
EXPOSE 5173

# Lệnh chạy Vite dev server, dùng --host để expose ra bên ngoài container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
