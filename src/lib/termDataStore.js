import { readFile } from 'fs/promises';
import path from 'path';

// Server only. The schedule terms' class dates and exams ({termCode: {dates, exams}}),
// downloaded at build by server/fetch_snapshot.sh from the snapshot pinned in termdata.lock.
const TERM_DATA_FILE = path.join(process.cwd(), 'server', 'termdata_out.json');

let termData = null;

export async function getTermData(term) {
  // Cache only a successful read so a missing file is retried, not pinned as null.
  if (!termData) {
    try {
      termData = JSON.parse(await readFile(TERM_DATA_FILE, 'utf8'));
    } catch (error) {
      console.error('Error loading term data:', error.message);
    }
  }
  return termData?.[term] ?? { dates: null, exams: {} };
}
