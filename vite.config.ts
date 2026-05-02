import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const base =
    (process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? '').trim() || './';
  return {
    plugins: [react(), tailwindcss()],
    base: base.endsWith('/') || base === '.' || base === './' ? base : `${base}/`,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Set DISABLE_HMR=true to turn off Hot Module Reload (some remote envs choke on watchers).
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
