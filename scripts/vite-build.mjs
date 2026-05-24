import { build } from 'vite';
import viteConfigExport from '../frontend/vite.config.js';

async function resolveConfig() {
  return typeof viteConfigExport === 'function'
    ? viteConfigExport({ command: 'build', mode: 'production' })
    : viteConfigExport;
}

const config = await resolveConfig();
await build({
  ...config,
  configFile: false,
});
