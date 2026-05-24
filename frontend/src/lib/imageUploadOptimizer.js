const MIME_EXTENSION_MAP = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

export const OPTIMIZABLE_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_IMAGE_UPLOAD_SOURCE_BYTES = 25 * 1024 * 1024;

export const IMAGE_UPLOAD_OPTIMIZATION_DEFAULTS = Object.freeze({
  maxDimension: 1600,
  minDimension: 320,
  targetMaxBytes: 450 * 1024,
  initialQuality: 0.82,
  minQuality: 0.46,
  qualityStep: 0.08,
  resizeStep: 0.82,
  maxResizePasses: 3,
  minimumSavingsBytes: 32 * 1024,
  minimumSavingsRatio: 0.08,
});

export const AVATAR_IMAGE_OPTIMIZATION_DEFAULTS = Object.freeze({
  maxDimension: 384,
  minDimension: 128,
  targetMaxBytes: 96 * 1024,
  initialQuality: 0.76,
  minQuality: 0.34,
  qualityStep: 0.08,
  resizeStep: 0.78,
  maxResizePasses: 4,
  minimumSavingsBytes: 4 * 1024,
  minimumSavingsRatio: 0.02,
});

function getNormalizedMimeType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function canOptimizeImagesInBrowser() {
  return (
    typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof URL !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
  );
}

function getExtensionForMimeType(mimeType) {
  return MIME_EXTENSION_MAP[getNormalizedMimeType(mimeType)] || 'bin';
}

function createQualityCandidates({
  initialQuality,
  minQuality,
  qualityStep,
}) {
  const qualities = [];

  for (let quality = initialQuality; quality >= minQuality; quality -= qualityStep) {
    qualities.push(Number(quality.toFixed(2)));
  }

  if (qualities[qualities.length - 1] !== minQuality) {
    qualities.push(minQuality);
  }

  return qualities;
}

function getBaseFileName(fileName = 'imagem') {
  const trimmed = String(fileName || 'imagem').trim();
  if (!trimmed.includes('.')) return trimmed || 'imagem';
  return trimmed.slice(0, trimmed.lastIndexOf('.')) || 'imagem';
}

async function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        resolve(blob || null);
      }, mimeType, quality);
    } catch (error) {
      reject(error);
    }
  });
}

export async function readFileAsDataUrl(file) {
  if (typeof FileReader === 'undefined') {
    throw new Error('Leitura de arquivos nao disponivel neste navegador.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Falha ao converter imagem para data URL.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(file);
  });
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context, width, height) => {
        context.drawImage(bitmap, 0, 0, width, height);
      },
      cleanup: () => {
        if (typeof bitmap.close === 'function') {
          bitmap.close();
        }
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Falha ao carregar imagem para otimizacao.'));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw: (context, width, height) => {
        context.drawImage(image, 0, 0, width, height);
      },
      cleanup: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function buildOutputFile(file, blob, mimeType) {
  const nextName = buildOptimizedImageFileName(file?.name, mimeType);

  if (typeof File === 'function') {
    return new File([blob], nextName, {
      type: mimeType,
      lastModified: file?.lastModified ?? Date.now(),
    });
  }

  return blob;
}

export function shouldOptimizeImageBeforeUpload(file) {
  const mimeType = getNormalizedMimeType(file?.type);
  return OPTIMIZABLE_IMAGE_MIME_TYPES.includes(mimeType);
}

export function buildOptimizedImageFileName(fileName, mimeType) {
  const baseName = getBaseFileName(fileName);
  const extension = getExtensionForMimeType(mimeType);
  return `${baseName}.${extension}`;
}

export async function optimizeImageForUpload(file, options = {}) {
  const settings = {
    ...IMAGE_UPLOAD_OPTIMIZATION_DEFAULTS,
    ...options,
  };

  if (!shouldOptimizeImageBeforeUpload(file)) {
    return { file, optimized: false, reason: 'unsupported_type' };
  }

  if (!canOptimizeImagesInBrowser()) {
    return { file, optimized: false, reason: 'browser_apis_unavailable' };
  }

  if ((file?.size ?? 0) <= settings.targetMaxBytes) {
    return { file, optimized: false, reason: 'already_small' };
  }

  const targetMimeType = getNormalizedMimeType(file.type) === 'image/png'
    ? 'image/webp'
    : getNormalizedMimeType(file.type);
  const qualities = createQualityCandidates(settings);
  const imageSource = await loadImageSource(file);
  const originalMaxDimension = Math.max(imageSource.width, imageSource.height);
  const initialScale = Math.min(1, settings.maxDimension / Math.max(originalMaxDimension, 1));
  let targetWidth = Math.max(1, Math.round(imageSource.width * initialScale));
  let targetHeight = Math.max(1, Math.round(imageSource.height * initialScale));
  let bestCandidate = null;

  try {
    for (let resizePass = 0; resizePass <= settings.maxResizePasses; resizePass += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext('2d', {
        alpha: targetMimeType !== 'image/jpeg',
      });

      if (!context) {
        return { file, optimized: false, reason: 'canvas_context_unavailable' };
      }

      if (targetMimeType === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, targetWidth, targetHeight);
      }

      imageSource.draw(context, targetWidth, targetHeight);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, targetMimeType, quality);
        if (!blob) continue;

        const candidate = {
          blob,
          width: targetWidth,
          height: targetHeight,
          mimeType: blob.type || targetMimeType,
          quality,
        };

        if (!bestCandidate || candidate.blob.size < bestCandidate.blob.size) {
          bestCandidate = candidate;
        }

        if (candidate.blob.size <= settings.targetMaxBytes) {
          break;
        }
      }

      if (bestCandidate?.blob.size <= settings.targetMaxBytes) {
        break;
      }

      const nextWidth = Math.max(settings.minDimension, Math.round(targetWidth * settings.resizeStep));
      const nextHeight = Math.max(settings.minDimension, Math.round(targetHeight * settings.resizeStep));

      if (nextWidth === targetWidth && nextHeight === targetHeight) {
        break;
      }

      targetWidth = nextWidth;
      targetHeight = nextHeight;
    }
  } finally {
    imageSource.cleanup?.();
  }

  if (!bestCandidate || bestCandidate.blob.size >= file.size) {
    return { file, optimized: false, reason: 'no_smaller_candidate' };
  }

  const savingsBytes = file.size - bestCandidate.blob.size;
  const savingsRatio = savingsBytes / Math.max(file.size, 1);
  const wasOversized = file.size > settings.targetMaxBytes || originalMaxDimension > settings.maxDimension;
  const shouldUseOptimized = (
    wasOversized
    || savingsBytes >= settings.minimumSavingsBytes
    || savingsRatio >= settings.minimumSavingsRatio
  );

  if (!shouldUseOptimized) {
    return { file, optimized: false, reason: 'insufficient_savings' };
  }

  return {
    file: buildOutputFile(file, bestCandidate.blob, bestCandidate.mimeType),
    optimized: true,
    originalSize: file.size,
    optimizedSize: bestCandidate.blob.size,
    originalType: file.type,
    optimizedType: bestCandidate.mimeType,
    width: bestCandidate.width,
    height: bestCandidate.height,
    savingsBytes,
    savingsRatio,
  };
}

export async function optimizeImageToDataUrl(file, options = {}) {
  const optimizationResult = await optimizeImageForUpload(file, options);
  const sourceFile = optimizationResult?.file || file;
  const dataUrl = await readFileAsDataUrl(sourceFile);

  return {
    ...optimizationResult,
    sourceFile,
    dataUrl,
  };
}
