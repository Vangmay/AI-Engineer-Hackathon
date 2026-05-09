import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Connect } from 'vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function caseAssetsMiddleware(): Connect.NextHandleFunction {
  const casesRoot = path.resolve(__dirname, 'data/cases');

  return (req, res, next) => {
    const rawUrl = (req.url ?? '').split('?')[0] ?? '';
    if (!rawUrl.startsWith('/case-assets/')) {
      next();
      return;
    }
    const rel = decodeURIComponent(rawUrl.slice('/case-assets/'.length));
    if (!rel || rel.includes('..')) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    const filePath = path.resolve(casesRoot, ...rel.split('/').filter(Boolean));
    const prefix = casesRoot.endsWith(path.sep) ? casesRoot : `${casesRoot}${path.sep}`;
    if (filePath !== casesRoot && !filePath.startsWith(prefix)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === '.json'
          ? 'application/json; charset=utf-8'
          : ext === '.mp3'
            ? 'audio/mpeg'
            : ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.end(data);
    });
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'case-assets',
      configureServer(server) {
        server.middlewares.use(caseAssetsMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(caseAssetsMiddleware());
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
