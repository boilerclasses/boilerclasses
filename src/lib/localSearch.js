// Runs course search in a worker once its index has downloaded. Until then
// (or if it can't load), callers use /api/search.
let worker = null;
let ready = false;
let nextId = 0;
const pending = new Map();

// Each deploy has a new build ID, and its course data never changes, so
// requests tagged with it can be cached by Cloudflare and the browser.
export const getBuildId = () =>
  (typeof window !== 'undefined' && window.__NEXT_DATA__?.buildId) || '';

export const isLocalSearchReady = () => ready;

export function startLocalSearch() {
  if (typeof window === 'undefined' || worker || typeof Worker === 'undefined') return;
  // The index is a few MB; skip it on low-memory phones and data saver.
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return;
  if (navigator.connection?.saveData) return;

  worker = new Worker(new URL('../workers/search.worker.js', import.meta.url));
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') {
      ready = true;
    } else if (data.type === 'failed') {
      console.warn('Browser search unavailable:', data.error);
    } else if (data.type === 'results') {
      pending.get(data.id)?.(data.documents);
      pending.delete(data.id);
    }
  };
  const v = getBuildId();
  worker.postMessage({
    type: 'load',
    docsUrl: `/api/search-index?part=docs&v=${v}`,
    indexUrl: `/api/search-index?part=index&v=${v}`,
  });
}

// Resolves with null when a newer search replaced this one.
export function searchLocally(params) {
  return new Promise(resolve => {
    const id = ++nextId;
    pending.set(id, resolve);
    worker.postMessage({ type: 'search', id, params });
  });
}
