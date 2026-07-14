import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

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

function autoSyncSapPlugin() {
  let isSyncing = false;
  return {
    name: 'auto-sync-sap-plugin',
    configureServer(server) {
      const excelPath = path.resolve(__dirname, 'sap_list.xlsx');
      server.watcher.add(excelPath);
      server.watcher.on('change', (filePath) => {
        if (path.resolve(filePath) === excelPath) {
          if (isSyncing) return;
          isSyncing = true;
          console.log('\n[Vite] sap_list.xlsx güncellendi! Otomatik senkronizasyon başlatılıyor...');
          exec('node scripts/sync_sap.js', (err, stdout, stderr) => {
            isSyncing = false;
            if (err) {
              console.error('[Vite] Otomatik senkronizasyon hatası:', err);
              return;
            }
            console.log(stdout.trim());
            // Tarayıcıyı otomatik olarak yenile
            server.hot.send({ type: 'full-reload' });
          });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    writeVersionPlugin(),
    autoSyncSapPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globIgnores: ['**/version.json'],
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
