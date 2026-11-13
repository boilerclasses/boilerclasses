// Keep the wrapper's existing queries and response shapes, but avoid its old
// node-fetch gzip reader, which failed in production with ERR_STREAM_PREMATURE_CLOSE.
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  searchTeacherQuery,
  getTeacherQuery,
} from '@mtucourses/rate-my-professors/dist/src/queries';
import { AUTH_TOKEN } from '@mtucourses/rate-my-professors/dist/src/constants';

// Every course page looks up each of its instructors, so without a cache RMP sees
// several requests per page view and starts answering HTTP 429. Ratings change slowly.
const FOUND_SECONDS = 7 * 24 * 60 * 60;
// RMP can add a missing professor any day, so a lookup with no match is asked again sooner.
const MISSING_SECONDS = 24 * 60 * 60;
// On disk instead of the container's Redis, which starts empty on every deploy.
// deploy/deploy.sh mounts a Docker volume here and server/script.sh drops expired answers.
const CACHE_DIR = path.join(process.cwd(), 'server', 'rmp_cache');
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

// Missing, expired and unreadable entries all count as a miss.
async function cacheGet(key) {
  try {
    const { expires, data } = JSON.parse(await fs.readFile(path.join(CACHE_DIR, key), 'utf8'));
    return expires > Date.now() ? data : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, data, seconds) {
  const file = path.join(CACHE_DIR, key);
  // During a deploy two containers share the folder, so write a temporary file and
  // rename it into place; a reader never sees half an entry.
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(temporary, JSON.stringify({ expires: Date.now() + seconds * 1000, data }));
    await fs.rename(temporary, file);
  } catch {
    // a failed write only means the next request asks RMP again
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

// Only successful answers are cached, so a 429 is retried on the next request.
async function request(query, variables, found) {
  const key = createHash('sha1').update(JSON.stringify([query, variables])).digest('hex');
  if (inFlight.has(key)) return inFlight.get(key);
  const pending = (async () => {
    const cached = await cacheGet(key);
    if (cached) return cached;
    const data = await fetchRMP(query, variables);
    await cacheSet(key, data, found(data) ? FOUND_SECONDS : MISSING_SECONDS);
    return data;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

const teachers = data => data.newSearch.teachers?.edges.map(edge => edge.node) || [];

export default {
  async searchTeacher(text, schoolID) {
    const data = await request(searchTeacherQuery, { text, schoolID }, data => teachers(data).length > 0);
    return teachers(data);
  },
  async getTeacher(id) {
    const data = await request(getTeacherQuery, { id }, data => Boolean(data.node));
    return data.node;
  },
};
