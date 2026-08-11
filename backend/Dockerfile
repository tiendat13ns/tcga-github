# Sử dụng Python 3.12 slim để image nhỏ gọn hơn
FROM python:3.12-slim

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết (ví dụ: cho psycopg2)
# curl được dùng cho healthcheck trong docker-compose.yml
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements trước để tận dụng cache của Docker
# (Nếu requirements.txt không thay đổi, bước pip install sẽ không chạy lại)
COPY requirements.txt .

# Cài đặt tất cả các thư viện Python
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code vào container
COPY . .

# Mở cổng 8000 để bên ngoài có thể truy cập vào FastAPI
EXPOSE 8000

# Lệnh chạy server khi container khởi động
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
