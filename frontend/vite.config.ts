import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const extras = (env.VITE_ALLOWED_HOSTS ?? process.env.VITE_ALLOWED_HOSTS ?? '')
    .split(',').map(h => h.trim()).filter(Boolean);

  return {
    plugins: [react(), tailwindcss(), {
      name: 'local-lottie-wasm',
      closeBundle() {
        const entrada = require.resolve('@lottiefiles/dotlottie-web');
        copyFileSync(resolve(dirname(entrada), 'dotlottie-player.wasm'), resolve('dist/dotlottie-player.wasm'));
      },
    }],
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['localhost', ...extras],
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
