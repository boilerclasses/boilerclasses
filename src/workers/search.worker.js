import { decodeCourses, loadIndex, searchCourses } from '@/lib/courseSearch.mjs';

let courses = [];
let index = null;
// Typing sends a search per keystroke; only the newest is worth running.
let latest = null;

const fetchPart = async (url, read) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Search index failed: ${response.status}`);
  return read(response);
};

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    try {
      const [docs, indexJson] = await Promise.all([
        fetchPart(data.docsUrl, response => response.json()),
        fetchPart(data.indexUrl, response => response.text()),
      ]);
      courses = decodeCourses(docs);
      index = loadIndex(indexJson);
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'failed', error: String(error) });
    }
  } else if (data.type === 'search') {
    if (latest) self.postMessage({ type: 'results', id: latest.id, documents: null });
    latest = data;
    // Searches that arrive while this one waits replace it.
    setTimeout(() => {
      if (latest !== data) return;
      latest = null;
      self.postMessage({ type: 'results', id: data.id, documents: searchCourses(courses, index, data.params) });
    });
  }
};
