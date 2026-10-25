import fs from 'fs';
import path from 'path';

// Course data is baked into each build, so a response for this build's ID
// never changes. The client sends that ID as `v`; Cloudflare and browsers can
// keep those responses until the next deploy changes the ID.
let buildId;

export function getBuildId() {
  if (buildId === undefined) {
    try {
      buildId = fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim();
    } catch {
      buildId = '';
    }
  }
  return buildId;
}

export function setCacheHeaders(req, res) {
  const current = getBuildId();
  if (current && current !== 'development' && req.query.v === current) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    // Old or missing build IDs (bots, tabs open across a deploy) get a short edge cache.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  }
}
