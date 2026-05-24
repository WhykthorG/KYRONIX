import staticBlue from '../assets/estatico/blue.webp?url';
import staticGreen from '../assets/estatico/green.webp?url';
import staticPurple from '../assets/estatico/purple.webp?url';
import staticRed from '../assets/estatico/red.webp?url';
import staticAmber from '../assets/estatico/amber.webp?url';

import mobileBlue from '../assets/video/blue.webm?url';
import mobileGreen from '../assets/video/green.webm?url';
import mobilePurple from '../assets/video/purple.webm?url';
import mobileRed from '../assets/video/red.webm?url';
import mobileAmber from '../assets/video/amber.webm?url';
import mobileTodo from '../assets/video/todo.webm?url';

const STATIC_BACKGROUND_ASSETS = [
  {
    id: 'estatico:blue.webp',
    source: staticBlue,
    fileName: 'blue.webp',
    label: 'Azul',
  },
  {
    id: 'estatico:green.webp',
    source: staticGreen,
    fileName: 'green.webp',
    label: 'Verde',
  },
  {
    id: 'estatico:purple.webp',
    source: staticPurple,
    fileName: 'purple.webp',
    label: 'Roxo',
  },
  {
    id: 'estatico:red.webp',
    source: staticRed,
    fileName: 'red.webp',
    label: 'Vermelho',
  },
  {
    id: 'estatico:amber.webp',
    source: staticAmber,
    fileName: 'amber.webp',
    label: 'Âmbar',
  },
];

const MOBILE_BACKGROUND_ASSETS = [
  {
    id: 'animado:blue.webm',
    source: mobileBlue,
    fileName: 'blue.webm',
    label: 'Azul',
  },
  {
    id: 'animado:green.webm',
    source: mobileGreen,
    fileName: 'green.webm',
    label: 'Verde',
  },
  {
    id: 'animado:purple.webm',
    source: mobilePurple,
    fileName: 'purple.webm',
    label: 'Roxo',
  },
  {
    id: 'animado:red.webm',
    source: mobileRed,
    fileName: 'red.webm',
    label: 'Vermelho',
  },
  {
    id: 'animado:amber.webm',
    source: mobileAmber,
    fileName: 'amber.webm',
    label: 'Âmbar',
  },
  {
    id: 'animado:todo.webm',
    source: mobileTodo,
    fileName: 'todo.webm',
    label: 'Todo',
  },
];

export const SHELL_BACKGROUND_TYPES = Object.freeze([
  {
    id: 'animado',
    label: 'Animado',
    description: 'Plano de fundo animado com vídeos da pasta `src/assets/video`.',
  },
  {
    id: 'estatico',
    label: 'Estático',
    description: 'Plano de fundo fixo com imagens da pasta `src/assets/estatico`.',
  },
]);

function normalizeMode(mode) {
  if (mode === 'animated') return 'animado';
  if (mode === 'static') return 'estatico';
  if (mode === 'movel') return 'animado';
  if (mode === 'animado' || mode === 'estatico') return mode;
  return 'animado';
}

function humanizeFileName(fileName) {
  const baseName = String(fileName || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .trim();

  return baseName || 'Plano de fundo';
}

function getAssetBaseName(assetId) {
  return String(assetId || '')
    .split(':')
    .pop()
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase();
}

function buildBackgroundAssets(items, type) {
  return items.map((item) => {
    const extension = item.fileName.split('.').pop()?.toLowerCase() || '';
    const assetType = type === 'animado' ? 'video' : 'image';
    const mimeType = assetType === 'video'
      ? (extension === 'mp4' ? 'video/mp4' : 'video/webm')
      : (
          extension === 'png' ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
          : extension === 'svg' ? 'image/svg+xml'
          : 'image/webp'
        );

    return {
      id: item.id,
      type,
      label: item.label || humanizeFileName(item.fileName),
      description: assetType === 'video'
        ? 'Vídeo da pasta `src/assets/video`.'
        : 'Imagem da pasta `src/assets/estatico`.',
      assetType,
      source: item.source,
      mimeType,
      fileName: item.fileName,
      extension,
    };
  });
}

export const SHELL_BACKGROUND_ASSETS = Object.freeze({
  animado: buildBackgroundAssets(MOBILE_BACKGROUND_ASSETS, 'animado'),
  estatico: buildBackgroundAssets(STATIC_BACKGROUND_ASSETS, 'estatico'),
});

export const DEFAULT_SHELL_BACKGROUND_MODE = 'animado';

export const DEFAULT_SHELL_BACKGROUND_ASSET_ID = (
  SHELL_BACKGROUND_ASSETS[DEFAULT_SHELL_BACKGROUND_MODE][0]?.id
  || SHELL_BACKGROUND_ASSETS.estatico[0]?.id
  || null
);

export function normalizeShellBackgroundMode(mode) {
  return normalizeMode(mode);
}

export function getShellBackgroundAssets(mode) {
  return SHELL_BACKGROUND_ASSETS[normalizeMode(mode)] || [];
}

export function getShellBackgroundTypeOptions() {
  return SHELL_BACKGROUND_TYPES.map((item) => ({
    ...item,
    assetCount: getShellBackgroundAssets(item.id).length,
  }));
}

export function getShellBackgroundDefaultAssetId(mode) {
  return getShellBackgroundAssets(mode)[0]?.id || DEFAULT_SHELL_BACKGROUND_ASSET_ID;
}

export function getShellBackgroundMatchingAssetId(mode, assetId) {
  const resolvedMode = normalizeMode(mode);
  const options = getShellBackgroundAssets(resolvedMode);
  if (options.length === 0) {
    return DEFAULT_SHELL_BACKGROUND_ASSET_ID;
  }

  if (!assetId) {
    return options[0].id;
  }

  const targetBaseName = getAssetBaseName(assetId);
  const directMatch = options.find((option) => option.id === assetId);
  if (directMatch) {
    return directMatch.id;
  }

  const baseNameMatch = options.find((option) => getAssetBaseName(option.id) === targetBaseName);
  if (baseNameMatch) {
    return baseNameMatch.id;
  }

  return options[0].id;
}

export function getShellBackgroundOption(mode, assetId) {
  const resolvedMode = normalizeMode(mode);
  const options = getShellBackgroundAssets(resolvedMode);
  const fallback = options[0] || SHELL_BACKGROUND_ASSETS.estatico[0] || SHELL_BACKGROUND_ASSETS.animado[0] || null;
  if (!fallback) return null;

  if (!assetId) return fallback;

  const directMatch = options.find((option) => option.id === assetId);
  if (directMatch) return directMatch;

  const baseName = getAssetBaseName(assetId);
  const baseNameMatch = options.find((option) => getAssetBaseName(option.id) === baseName);
  return baseNameMatch || fallback;
}
