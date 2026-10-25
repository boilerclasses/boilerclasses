import { readFile } from 'fs/promises';
import path from 'path';
import { CURRENT_SEMESTER_CODE } from '@/lib/terms';

// Schedule terms' sections ({termCode: {detailId: sections}}), downloaded at build by
// server/fetch_snapshot.sh from the snapshot pinned in sections.lock.
const SECTIONS_FILE = path.join(process.cwd(), 'server', 'sections_out.json');

let sections = null;

async function getAllSections() {
  // Cache only a successful read so a missing file is retried, not pinned as null.
  if (!sections) {
    try {
      const data = JSON.parse(await readFile(SECTIONS_FILE, 'utf8'));
      // Snapshots pinned before multi-term support hold only the current term ({detailId: sections}).
      const singleTerm = Object.values(data).some(Array.isArray);
      sections = singleTerm ? { [CURRENT_SEMESTER_CODE]: data } : data;
    } catch (error) {
      console.error('Error loading sections:', error.message);
    }
  }
  return sections;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const all = await getAllSections();
    const term = String(req.query.term ?? CURRENT_SEMESTER_CODE);
    res.status(200).json({ sections: all?.[term]?.[String(req.query.detailId)] ?? null });
  }
}
