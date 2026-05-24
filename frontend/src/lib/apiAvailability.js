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
