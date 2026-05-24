// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import { createServer } from 'vite';
import viteConfigExport from '../frontend/vite.config.js';

async function resolveConfig() {
  return typeof viteConfigExport === 'function'
    ? viteConfigExport({ command: 'serve', mode: process.env.NODE_ENV || 'development' })
    : viteConfigExport;
}

const config = await resolveConfig();
const server = await createServer({
  ...config,
  configFile: false,
});

await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
