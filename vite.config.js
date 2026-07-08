import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 💡 로컬 개발 중 "/api"로 시작하는 요청을 전부 Express 프록시 서버(3001번 포트)로 넘겨줍니다.
      // App.jsx가 이제 상대경로(/api/analyze-image, /api/health)를 쓰기 때문에 필요합니다.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  }
});
