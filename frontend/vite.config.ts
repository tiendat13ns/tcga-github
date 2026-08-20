import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1302,
    // Cần thiết khi chạy bên trong Docker để expose ra bên ngoài container
    host: true,
    allowedHosts: true,
    watch: {
      // Bind mount trên Windows/Docker Desktop không forward inotify events đầy đủ,
      // nên phải bật polling để Vite phát hiện thay đổi file và tự reload.
      usePolling: true,
      interval: 300,
    },
    proxy: {
      // Tự động chuyển tiếp các request /api sang backend
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
