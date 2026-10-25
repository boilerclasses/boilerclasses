// A whole plan packed into a URL-safe string, for share links (/schedule?s=...) and the
// calendar feed (/api/calendar.ics?s=...). No storage: the link is the schedule.
//
// Packed as JSON arrays to keep links short:
//   [version, term, [[detailId, "SUBJ 12345", colorIndex, [crns]]...], [[title, colorIndex, "days", start, end]...]]
// where "days" is the weekday indexes ("024" = Mon/Wed/Fri) and times are minutes.
import { WEEK } from '@/lib/schedule';

const VERSION = 1;

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
};

export const encodeSchedule = ({ term, courses, blocks }) => toBase64Url(JSON.stringify([
  VERSION,
  term,
  courses.map(c => [c.detailId, c.name, c.colorIndex, c.crns]),
  blocks.map(b => [b.title, b.colorIndex, b.days.map(day => WEEK.indexOf(day)).join(''), b.start, b.end]),
]));

// The plan in a share string, or null if it isn't one.
export const decodeSchedule = (value) => {
  try {
    const [version, term, courses, blocks] = JSON.parse(fromBase64Url(String(value)));
    if (version !== VERSION || typeof term !== 'string') return null;
    return {
      term,
      courses: courses.map(([detailId, name, colorIndex, crns]) => ({
        detailId: String(detailId), name: String(name), colorIndex: Number(colorIndex) || 0,
        crns: crns.map(Number).filter(Number.isFinite),
      })),
      blocks: blocks.map(([title, colorIndex, days, start, end], index) => ({
        id: `shared-${index}`, title: String(title), colorIndex: Number(colorIndex) || 0,
        days: [...String(days)].map(i => WEEK[Number(i)]).filter(Boolean),
        start: Number(start), end: Number(end),
      })).filter(b => b.days.length && b.end > b.start),
    };
  } catch {
    return null;
  }
};
