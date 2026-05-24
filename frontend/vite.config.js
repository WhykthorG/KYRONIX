// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeApiPrefix(pathname = '') {
  const normalized = String(pathname || '').trim();

  if (normalized.startsWith('/.netlify/functions/api/')) {
    return normalized.slice('/.netlify/functions/api/'.length);
  }

  if (normalized === '/.netlify/functions/api') {
    return '';
  }

  if (normalized.startsWith('/api/')) {
    return normalized.slice('/api/'.length);
  }

  if (normalized === '/api') {
    return '';
  }

  return normalized.replace(/^\/+/, '');
}

function getApiRouteSegments(pathname = '') {
  return normalizeApiPrefix(pathname)
    .split('/')
    .map((segment) => String(segment || '').trim())
    .filter(Boolean);
}

function resolveApiHandlerFromRoot(apiRoot, segments, currentDir = apiRoot, index = 0, params = {}) {
  if (index >= segments.length) {
    const indexFile = path.join(currentDir, 'index.js');
    if (fs.existsSync(indexFile)) {
      return { filePath: indexFile, params };
    }
    return null;
  }

  const segment = segments[index];
  const isLast = index === segments.length - 1;

  const directFile = path.join(currentDir, `${segment}.js`);
  if (isLast && fs.existsSync(directFile)) {
    return { filePath: directFile, params };
  }

  const directDir = path.join(currentDir, segment);
  if (fs.existsSync(directDir) && fs.statSync(directDir).isDirectory()) {
    const directMatch = resolveApiHandlerFromRoot(apiRoot, segments, directDir, index + 1, params);
    if (directMatch) {
      return directMatch;
    }
  }

  const entries = fs.existsSync(currentDir) ? fs.readdirSync(currentDir, { withFileTypes: true }) : [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('[') || !entry.name.endsWith('].js') || !isLast) {
      continue;
    }

    const paramName = entry.name.slice(1, -4);
    return {
      filePath: path.join(currentDir, entry.name),
      params: { ...params, [paramName]: segment },
    };
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('[') || !entry.name.endsWith(']')) {
      continue;
    }

    const paramName = entry.name.slice(1, -1);
    const dynamicMatch = resolveApiHandlerFromRoot(
      apiRoot,
      segments,
      path.join(currentDir, entry.name),
      index + 1,
      { ...params, [paramName]: segment },
    );

    if (dynamicMatch) {
      return dynamicMatch;
    }
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('[...') || !entry.name.endsWith('].js')) {
      continue;
    }

    const paramName = entry.name.slice(4, -4);
    const remainingSegments = segments.slice(index);

    return {
      filePath: path.join(currentDir, entry.name),
      params: { ...params, [paramName]: remainingSegments },
    };
  }

  return null;
}

function createApiDevPlugin() {
  const apiRoot = path.resolve(__dirname, '../backend/src/routes');

  async function parseJsonBody(req) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return undefined;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  return {
    name: 'local-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ? new URL(req.url, 'http://localhost') : null;
        const pathname = requestUrl?.pathname || '';

        if (!pathname.startsWith('/api/')) {
          next();
          return;
        }

        const segments = getApiRouteSegments(pathname);
        const resolved = resolveApiHandlerFromRoot(apiRoot, segments);

        if (!resolved?.filePath) {
          next();
          return;
        }

        try {
          req.query = Object.fromEntries(requestUrl.searchParams.entries());
          req.body = await parseJsonBody(req);
          req.cookies = {};
          req.params = resolved.params;

          res.status = (statusCode) => {
            res.statusCode = statusCode;
            return res;
          };

          const imported = await server.ssrLoadModule(pathToFileURL(resolved.filePath).href);
          const handler = imported?.default;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Handler de API inválido.' }));
            return;
          }

          await handler(req, res);
        } catch (error) {
          console.error('[vite-api-dev]', error);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error?.message || 'Erro interno no middleware de API.' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const workspaceRoot = path.resolve(__dirname, '..');
  const env = {
    ...loadEnv(mode, workspaceRoot, ''),
    ...loadEnv(mode, __dirname, ''),
  };
  Object.assign(process.env, env);

  return {
    root: __dirname,
    plugins: [react(), createApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            query: ['@tanstack/react-query'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
