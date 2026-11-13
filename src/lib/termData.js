// Helpers for a term's class dates and exams (server/scrape_term_data.py), shared by the
// schedule page and the calendar feed.

// A course's exam rows, keyed in the registrar's PDFs as "SUBJ 12345". The PDFs also list
// variants with a letter suffix (honors "20300H", CS 18000's "BLK"/"GLD" tracks); those
// count only when the plain number isn't listed.
export const courseExamRows = (exams, subjectCode, courseCode) => {
  if (!exams) return [];
  const key = `${subjectCode} ${courseCode}`;
  return exams[key] ?? Object.entries(exams)
    .filter(([name]) => name.startsWith(key) && /^[A-Z]+$/.test(name.slice(key.length)))
    .flatMap(([, list]) => list);
};

// The exams a student with these CRNs sits: rows naming a CRN apply only to that section.
// A big course can hold one exam in several sittings the same evening (CS 18000 at 6:30
// and 8:00); a student is in only one, so they become one exam that lists each sitting.
export const examsFor = (rows, crns) => {
  const byDay = new Map();
  for (const row of rows) {
    if (row.crn != null && !crns.includes(row.crn)) continue;
    const key = `${row.kind}|${row.date}`;
    const exam = byDay.get(key) ?? { ...row, rooms: [], sittings: [] };
    if (!exam.sittings.some(s => s.start === row.start)) exam.sittings.push({ start: row.start, end: row.end });
    exam.rooms = [...new Set([...exam.rooms, ...row.rooms])];
    byDay.set(key, exam);
  }
  return [...byDay.values()].map(exam => {
    exam.sittings.sort((a, b) => a.start.localeCompare(b.start));
    return {
      ...exam,
      start: exam.sittings[0].start,
      end: exam.sittings.reduce((last, s) => (s.end > last ? s.end : last), exam.end),
    };
  }).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
};

export const EXAM_LABELS = { final: 'Final exam', evening: 'Evening exam' };
