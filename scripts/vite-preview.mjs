import { preview } from 'vite';
import viteConfigExport from '../frontend/vite.config.js';

async function resolveConfig() {
  return typeof viteConfigExport === 'function'
    ? viteConfigExport({ command: 'serve', mode: 'production' })
    : viteConfigExport;
}

const config = await resolveConfig();
const server = await preview({
  ...config,
  configFile: false,
});

server.printUrls();
