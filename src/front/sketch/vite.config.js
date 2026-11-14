import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), alerts: fileURLToPath(new URL('./alerts/index.html', import.meta.url)) } } },
  server: { fs: { allow: [workspaceRoot] }, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
