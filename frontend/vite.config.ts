import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const extras = (env.VITE_ALLOWED_HOSTS ?? process.env.VITE_ALLOWED_HOSTS ?? '')
    .split(',').map(h => h.trim()).filter(Boolean);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['localhost', ...extras],
      proxy: {
        '/api': {
          target: 'https://barbearia-backend-production-f72d.up.railway.app',
          // target: 'http://localhost:3001',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
