import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Deck (/) + app del público para el celular (/live/)
export default defineConfig({
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/answers.json'],
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        deck: resolve(__dirname, 'index.html'),
        live: resolve(__dirname, 'live/index.html'),
      },
    },
  },
});
