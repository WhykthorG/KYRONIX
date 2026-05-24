// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
const unavailableApiBases = new Set();

export function isApiBaseUnavailable(apiBase) {
  return unavailableApiBases.has(apiBase);
}

export function markApiBaseUnavailable(apiBase) {
  if (typeof apiBase === 'string' && apiBase.trim()) {
    unavailableApiBases.add(apiBase);
  }
}

export function isApiRouteMissing(response) {
  return Number(response?.status) === 404;
}
