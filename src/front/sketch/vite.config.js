import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), overview: fileURLToPath(new URL('./overview.html', import.meta.url)), alerts: fileURLToPath(new URL('./alerts/index.html', import.meta.url)), vuelo: fileURLToPath(new URL('./vuelo.html', import.meta.url)) } } },
  server: { fs: { allow: [workspaceRoot] }, proxy: { '/api/v1/plan': 'http://127.0.0.1:3001', '/api/v1/routines': 'http://127.0.0.1:3001', '/api': 'http://127.0.0.1:3000' } },
});
