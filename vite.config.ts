import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import nodemailer from 'nodemailer';

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
    configureServer(server: any) {
      const excelPath = path.resolve(__dirname, 'sap_list.xlsx');
      server.watcher.add(excelPath);
      server.watcher.on('change', (filePath: string) => {
        if (path.resolve(filePath) === excelPath) {
          if (isSyncing) return;
          isSyncing = true;
          console.log('\n[Vite] sap_list.xlsx güncellendi! Otomatik senkronizasyon başlatılıyor...');
          exec('node scripts/sync_sap.js', (err, stdout) => {
            isSyncing = false;
            if (err) {
              console.error('[Vite] Otomatik senkronizasyon hatası:', err);
              return;
            }
            console.log(stdout.trim());
            server.hot.send({ type: 'full-reload' });
          });
        }
      });
    }
  };
}

function gmailEmailPlugin() {
  return {
    name: 'gmail-email-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/send-email', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const { to, subject, html, pdfBase64, filename } = payload;
            const targetEmail = to || 'fatih.zebek@demirerholding.com, emir.unver@demirerholding.com, hursit.akter@demirerholding.com';

            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'dhservisrapor@gmail.com',
                pass: 'mulm vszx xrwj nshx'
              }
            });

            const mailOptions: any = {
              from: '"DH-Servis Rapor" <dhservisrapor@gmail.com>',
              replyTo: 'servis.rapor@demirerholding.com',
              to: targetEmail,
              subject: subject,
              html: html
            };

            if (pdfBase64 && filename) {
              mailOptions.attachments = [
                {
                  filename: filename,
                  content: Buffer.from(pdfBase64, 'base64'),
                  contentType: 'application/pdf'
                }
              ];
            }

            const info = await transporter.sendMail(mailOptions);
            console.log('[Gmail SMTP Dispatch] E-posta ve PDF eki başarıyla iletildi:', info.messageId);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, messageId: info.messageId }));
          } catch (err: any) {
            console.error('[Gmail SMTP Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    writeVersionPlugin(),
    autoSyncSapPlugin(),
    gmailEmailPlugin(),
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
