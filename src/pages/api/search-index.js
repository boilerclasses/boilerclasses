import fs from 'fs';
import path from 'path';
import { setCacheHeaders } from '../../lib/cache';

// Files for browser-side search: course data written by server/push.py and
// the prebuilt index written by server/build_search_index.mjs.
const files = {
  docs: path.join(process.cwd(), 'server', 'search_index.json'),
  index: path.join(process.cwd(), 'server', 'search_minisearch.json'),
};
const loaded = {};

export const config = { api: { responseLimit: false } };

export default function handler(req, res) {
  const file = files[req.query.part];
  if (req.method !== 'GET' || !file) {
    res.status(404).end();
    return;
  }
  try {
    loaded[req.query.part] ??= fs.readFileSync(file);
  } catch {
    // Still building after a deploy; the browser keeps using /api/search.
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).end();
    return;
  }
  setCacheHeaders(req, res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(loaded[req.query.part]);
}
