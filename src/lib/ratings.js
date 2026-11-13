// Keep the wrapper's existing queries and response shapes, but avoid its old
// node-fetch gzip reader, which failed in production with ERR_STREAM_PREMATURE_CLOSE.
import {
  searchTeacherQuery,
  getTeacherQuery,
} from '@mtucourses/rate-my-professors/dist/src/queries';
import { AUTH_TOKEN } from '@mtucourses/rate-my-professors/dist/src/constants';

// Every course page asks for each of its instructors, so the same lookups repeat
// constantly. Keep answers for a day, and share one RMP call between requests
// that arrive while it is still running.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 20000;
const cache = new Map();

function cached(key, load) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  cache.delete(key);
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  const value = load();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  // A failed call isn't kept, so the next request tries RMP again.
  value.catch(() => cache.delete(key));
  return value;
}

async function request(query, variables) {
  const response = await fetch('https://www.ratemyprofessors.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${AUTH_TOKEN}`,
      'Accept-Encoding': 'identity',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`RMP returned HTTP ${response.status}`);
  const { data, errors } = await response.json();
  if (errors?.length || !data) throw new Error('RMP returned an invalid GraphQL response');
  return data;
}

export default {
  searchTeacher(text, schoolID) {
    return cached(`search:${schoolID}:${text}`, async () => {
      const data = await request(searchTeacherQuery, { text, schoolID });
      return data.newSearch.teachers?.edges.map(edge => edge.node) || [];
    });
  },
  getTeacher(id) {
    return cached(`teacher:${id}`, async () => {
      const data = await request(getTeacherQuery, { id });
      return data.node;
    });
  },
};
