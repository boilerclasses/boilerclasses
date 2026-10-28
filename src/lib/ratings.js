// Keep the wrapper's existing queries and response shapes, but avoid its old
// node-fetch gzip reader, which failed in production with ERR_STREAM_PREMATURE_CLOSE.
import { createHash } from 'crypto';
import {
  searchTeacherQuery,
  getTeacherQuery,
} from '@mtucourses/rate-my-professors/dist/src/queries';
import { AUTH_TOKEN } from '@mtucourses/rate-my-professors/dist/src/constants';
import { cacheGet, cacheSet } from './redis';

// Every course page looks up each of its instructors, so without a cache RMP sees
// several requests per page view and starts answering HTTP 429. Ratings change slowly.
const CACHE_SECONDS = 7 * 24 * 60 * 60;
// Identical lookups that arrive together (a popular page right after a deploy) share one request.
const inFlight = new Map();

async function fetchRMP(query, variables) {
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

// Only successful answers are cached, so a 429 is retried on the next request.
async function request(query, variables) {
  const key = 'rmp:' + createHash('sha1').update(JSON.stringify([query, variables])).digest('hex');
  if (inFlight.has(key)) return inFlight.get(key);
  const pending = (async () => {
    const cached = await cacheGet(key);
    if (cached) return cached;
    const data = await fetchRMP(query, variables);
    await cacheSet(key, data, CACHE_SECONDS);
    return data;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

export default {
  async searchTeacher(text, schoolID) {
    const data = await request(searchTeacherQuery, { text, schoolID });
    return data.newSearch.teachers?.edges.map(edge => edge.node) || [];
  },
  async getTeacher(id) {
    const data = await request(getTeacherQuery, { id });
    return data.node;
  },
};
