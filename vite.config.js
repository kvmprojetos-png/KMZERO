import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Versão do package.json vira __APP_VERSION__ no código (rodapé do login/menu/Ajuda):
// pelo print do cliente o suporte sabe qual build ele está vendo.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

// A vitrine (index.html da raiz) fica sem manifest e sem service worker: só o app em /app/ é PWA.
// O vite-plugin-pwa injeta essas tags em TODO html do build; aqui elas são tiradas só da vitrine.
function vitrineSemPwa() {
  return {
    name: 'kmzero:vitrine-sem-pwa',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const caminho = String((ctx && (ctx.path || ctx.filename)) || '').replace(/\\/g, '/');
        if (/\/app\/index\.html$/.test(caminho)) return html;
        return html
          .replace(/<link rel="manifest"[^>]*>/g, '')
          .replace(/<script id="vite-plugin-pwa:[^"]*"[^>]*>[\s\S]*?<\/script>/g, '');
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O registro fica em src/main.jsx (registerSW + controllerchange): o registerSW.js
      // injetado pelo plugin não recarregava a página quando o SW novo assumia.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/app/',
        start_url: '/app/',
        scope: '/app/',
        name: 'KMZERO - Gestão de Obras',
        short_name: 'KMZERO',
        description: 'Sistema de gestão inteligente de obras - KM Consultoria',
        theme_color: '#052f3d',
        background_color: '#052f3d',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt-BR',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // A vitrine (/) e o que só ela usa (capturas da demo, og.png, termos) não entram no cache do app: sempre vêm da rede
        globIgnores: ['index.html', 'capturas/**', 'og.png', 'termos.html', 'privacidade.html'],
        maximumFileSizeToCacheInBytes: 5000000,
        // Só as navegações dentro de /app/ caem no app; a raiz (/) é a vitrine estática
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app/],
        // Notificações (push) — o código fica em public/push-sw.js
        importScripts: ['push-sw.js']
      }
    }),
    vitrineSemPwa()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  build: {
    target: 'es2018',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        vitrine: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html')
      }
    }
  }
});
