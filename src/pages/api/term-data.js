import { getTermData } from '@/lib/termDataStore';
import { courseExamRows } from '@/lib/termData';

// A schedule term's class dates and, for the courses asked for, their exams:
// GET ?term=202710&courses=CS 18000,MA 26100
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { dates, exams } = await getTermData(String(req.query.term));
  const courses = String(req.query.courses ?? '').split(',').map(name => name.trim()).filter(Boolean);
  const examsByCourse = Object.fromEntries(courses.map(name => {
    const [subject, code] = name.split(' ');
    // every section's rows; the page keeps the ones for the sections it has chosen
    return [name, courseExamRows(exams, subject, code)];
  }));
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ dates, exams: examsByCourse });
}
