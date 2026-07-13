import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

function writeVersionPlugin() {
  return {
    name: 'write-version-plugin',
    writeBundle() {
      const ver = { version: Date.now().toString() };
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/version.json'),
        JSON.stringify(ver)
      );
    }
  };
}

export default defineConfig({
  plugins: [
    writeVersionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/KKD/],
        importScripts: ['/push-sw.js']
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'icons/*.webp', 'icons/*.png', 'icons.svg', 'dh-favicon.svg'],
      manifest: {
        name: 'DH Servis',
        short_name: 'DH Servis',
        description: 'Demirer Holding Saha Servis Yönetim Sistemi',
        theme_color: '#00f3ff',
        background_color: '#002d6b',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
        }
      }
    }
  }
});
